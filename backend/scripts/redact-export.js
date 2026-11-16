// Pseudonymized database export for research/analysis. Runs under mongosh.
//
// Usage (normally called by db-dump.sh, against a scratch copy of the data):
//   REDACT_KEY=... mongosh mongodb://HOST/aquaponics_dev --quiet --file redact-export.js
//
// What it does:
//   - Exports ONLY the collections listed in POLICY below. Anything else
//     (including `sessions`, which holds live login tokens and emails, and any
//     collection added in the future) is skipped. New collections must be
//     reviewed and added here on purpose.
//   - Within each exported collection, keeps only allowlisted fields.
//   - Replaces user identifiers with a keyed pseudonym:
//     HMAC-SHA256(REDACT_KEY, userId), first 12 hex chars. The same student
//     gets the same pseudonym across exports made with the same key, so
//     longitudinal analysis works. Without the key, pseudonyms can't be reversed
//     by hashing a class roster (a plain unkeyed hash of an email can be).
//   - Drops email, username and passwordHash entirely. Account timestamps are
//     reduced to the date only.
//
// REDACT_KEY must be kept by the data steward, never stored alongside exports,
// and never given to analysts.

const crypto = require('crypto');

const KEY = process.env.REDACT_KEY;
if (!KEY || KEY.length < 16) {
  print('ERROR: set REDACT_KEY (16+ chars; e.g. `openssl rand -hex 32`). Refusing to export.');
  quit(2);
}

function pseudo(v) {
  if (v === null || v === undefined || v === '') return null;
  return crypto.createHmac('sha256', KEY).update(String(v)).digest('hex').substring(0, 12);
}
function dateOnly(d) {
  return d instanceof Date ? d.toISOString().substring(0, 10) : null;
}

// collection -> function(doc) returning the redacted doc
const POLICY = {
  users: (d) => ({
    user: pseudo(d._id),
    createdDate: dateOnly(d.createdAt),
    lastLoginDate: dateOnly(d.lastLoginAt),
  }),
  matches: (d) => ({
    matchID: d.matchID,
    user: pseudo(d.ownerUserId),
    ownerUserId: pseudo(d.ownerUserId), // kept for analyze-matches.py compatibility
    status: d.status,
    gameTime: d.gameTime,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    G: d.G,     // game state: fish, plants, money, water chemistry, events
    ctx: d.ctx, // turn bookkeeping
  }),
  water_readings: (d) => {
    const { _id, ...rest } = d; // per-day simulation snapshot keyed by matchID
    return rest;
  },
};

const present = db.getCollectionNames();
const skipped = present.filter((c) => !(c in POLICY));

print('=== EXPORT INFO ===');
print('exported: ' + Object.keys(POLICY).filter((c) => present.includes(c)).join(', '));
print('skipped (not in allowlist): ' + (skipped.join(', ') || '(none)'));

print('\n=== REDACTED DATA ===');
const out = {};
for (const [c, fn] of Object.entries(POLICY)) {
  if (!present.includes(c)) continue;
  out[c] = db[c].find().toArray().map(fn);
}
print(JSON.stringify(out, null, 2));
