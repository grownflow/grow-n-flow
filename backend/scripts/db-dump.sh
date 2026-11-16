#!/usr/bin/env bash
# Back up the game database and, optionally, produce a pseudonymized export
# for analysis. See "Game data and logs" in HOSTING.md.
#
# Usage:
#   backend/scripts/db-dump.sh                      # raw backup only (contains student PII)
#   REDACT_KEY=... backend/scripts/db-dump.sh --redact
#                                                   # raw backup + pseudonymized JSON
#   REDACT_KEY=... backend/scripts/db-dump.sh --redact --analyze
#                                                   # ...plus a per-match text summary
#   REDACT_KEY=... backend/scripts/db-dump.sh --redact --no-keep-raw
#                                                   # delete the raw backup afterwards
#   REDACT_KEY=... backend/scripts/db-dump.sh --redact --from FILE.gz
#                                                   # redact an existing raw backup
#
# Env:
#   DUMP_DIR    output directory (default: ~/gnf-dumps, created mode 700)
#   DB_NAME     database name (default: aquaponics_dev)
#   CONTAINER   container CLI: docker or podman (default: docker if present)
#   COMPOSE     compose command (default: "$CONTAINER compose")
#   REDACT_KEY  secret for pseudonyms; required with --redact. Keep it out of
#               DUMP_DIR and never share it with whoever receives the export.
#
# Needs only the container runtime: mongodump, mongorestore and mongosh run
# inside containers. --analyze also needs python3.

set -euo pipefail
umask 077   # every file this script writes is readable by the owner only

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
COMMIT=$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")
DUMP_DIR="${DUMP_DIR:-$HOME/gnf-dumps}"
DB_NAME="${DB_NAME:-aquaponics_dev}"
CONTAINER="${CONTAINER:-$(command -v docker >/dev/null && echo docker || echo podman)}"
COMPOSE="${COMPOSE:-$CONTAINER compose}"

DO_REDACT=false; DO_ANALYZE=false; KEEP_RAW=true; FROM=""
while [ $# -gt 0 ]; do
  case "$1" in
    --redact)      DO_REDACT=true ;;
    --analyze)     DO_ANALYZE=true; DO_REDACT=true ;;
    --no-keep-raw) KEEP_RAW=false ;;
    --from)        FROM="$2"; shift ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

if $DO_REDACT && [ "${#REDACT_KEY}" -lt 16 ]; then
  echo "REDACT_KEY must be set (16+ chars) for --redact. Generate one with: openssl rand -hex 32" >&2
  exit 1
fi

mkdir -p "$DUMP_DIR"
chmod 700 "$DUMP_DIR"
BASE="$DUMP_DIR/${DB_NAME}_${TIMESTAMP}_${COMMIT}"

# --- Step 1: raw backup (or use an existing one) ---
if [ -n "$FROM" ]; then
  DUMP_FILE="$FROM"
  KEEP_RAW=true   # never delete a file we didn't create
else
  DUMP_FILE="$BASE.gz"
  echo "==> Dumping $DB_NAME from the running mongo service..."
  $COMPOSE -f "$REPO_DIR/docker-compose.yml" exec -T mongo \
    mongodump --db "$DB_NAME" --archive --gzip --quiet > "$DUMP_FILE"
  echo "    Raw backup (contains PII): $DUMP_FILE"
fi

$DO_REDACT || { echo "Done."; exit 0; }

# --- Step 2: restore into a throwaway mongo with no network, export pseudonymized JSON ---
SCRATCH="gnf-redact-$$"
REDACTED_FILE="$BASE.redacted.json"
cleanup() { $CONTAINER rm -f "$SCRATCH" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> Starting scratch mongo (no network)..."
$CONTAINER run -d --rm --network none --name "$SCRATCH" mongo:7 >/dev/null
for _ in $(seq 1 30); do
  $CONTAINER exec "$SCRATCH" mongosh --quiet --eval 'db.adminCommand({ping:1}).ok' >/dev/null 2>&1 && break
  sleep 1
done

echo "==> Restoring into scratch instance..."
$CONTAINER exec -i "$SCRATCH" mongorestore --archive --gzip --quiet < "$DUMP_FILE"

echo "==> Exporting pseudonymized JSON..."
$CONTAINER exec -i "$SCRATCH" sh -c 'cat > /tmp/redact.js' < "$SCRIPT_DIR/redact-export.js"
$CONTAINER exec -e REDACT_KEY "$SCRATCH" \
  mongosh "mongodb://127.0.0.1/$DB_NAME" --quiet --file /tmp/redact.js > "$REDACTED_FILE"
echo "    Pseudonymized export: $REDACTED_FILE"

if ! $KEEP_RAW; then
  rm -f "$DUMP_FILE"
  echo "    Deleted raw backup."
fi

# --- Step 3: optional summary ---
if $DO_ANALYZE; then
  python3 "$SCRIPT_DIR/analyze-matches.py" "$REDACTED_FILE" > "$BASE.analysis.txt"
  echo "    Analysis: $BASE.analysis.txt"
fi
echo "Done."
