# Hosting Grow-n-Flow

Notes for anyone putting the game on a public URL. They come from a real deployment and the problems it ran into. None of this is required for local development: `docker compose up --build` still works as before.

## What the app needs

| Piece | What it is | Notes |
|---|---|---|
| Frontend | React app built with Vite (`FlowFarmFrontend/`) | For production, `npm run build` produces static files in `dist/`. Any static file server can serve them. |
| Backend | Node 22 + Express on port 4000 (`backend/`) | Holds game state and sessions. The boardgame.io server on port 8000 is not used by the frontend and does not need to be exposed. |
| Database | MongoDB 7 | Stores matches, users and sessions. Small: a few MB per hundred matches. |
| TLS | HTTPS certificate | Required. Session cookies are marked `Secure` in production and browsers won't send them over plain HTTP. |

## The one rule: serve everything from one origin

The frontend calls the API with **relative** URLs (`/api/...`). Whatever serves the page must also route `/api/*` to the backend, on the same hostname and port.

```
browser ──https──▶ reverse proxy ──┬─ /api/*  ──▶ backend :4000 ──▶ MongoDB
                                   └─ /*      ──▶ frontend (static dist/ or vite)
```

Why it matters:

- **Login sessions use a cookie** with `SameSite=Lax`. If the frontend and API are on different sites, browsers treat the cookie as third-party and drop it, and users can't stay logged in.
- **No CORS setup is needed** when everything shares one origin.
- **The code has no hostnames in it,** so moving to a new host doesn't need a code change.

During local development, Vite's dev server does the `/api` routing (see `server.proxy` in `vite.config.js`).

## Hosting options

Roughly in order of effort. Prices and free-tier limits change often, so check current terms.

### 1. An institutional or departmental server

If the project has a university or lab sponsor, ask their IT group for a small Linux VM, a DNS name and a certificate. Many campuses provide these free for teaching and research projects.

- **Pros:** usually free, data stays inside the institution (which can help with student-data rules), and there's often a sysadmin to ask.
- **Cons:** you may get a high port or VPN-only access, and request turnaround can be slow.
- **What to ask for:**
  - A VM with Docker or Podman, 2 GB RAM and about 10 GB of disk.
  - Inbound 443, plus 80 if you want automatic certificates.
  - A hostname.

### 2. A small VPS running Docker Compose

Any VPS provider (DigitalOcean, Hetzner, Linode/Akamai, AWS Lightsail and so on). The cheapest tier with 1–2 GB RAM is enough.

- **Pros:** full control, cheap, and runs the existing `docker-compose.yml` almost unchanged.
- **Cons:** you are the sysadmin, responsible for OS updates, backups and monitoring.
- **Setup:** put **Caddy** in front, because it gets and renews certificates automatically. See [Example: Caddy](#example-caddy).

### 3. Platform-as-a-service with managed Mongo

For example, the backend as a web service on Render, Railway or Fly.io, the frontend as a static site on the same platform or on Netlify, Cloudflare Pages or Vercel, and **MongoDB Atlas** for the database (it has a free tier).

- **Pros:** no servers to patch, TLS handled for you, and deploys from git.
- **Cons:** free tiers often sleep when idle, so the first request after a pause is slow. Sessions are stored in Mongo, so they survive restarts. Costs can grow with usage.
- **Important:** if the frontend and backend end up on different hostnames, set up a **rewrite/proxy rule** on the static host so `/api/*` forwards to the backend URL. Most static hosts support this (`_redirects`, `vercel.json` rewrites, or Render's rewrite rules). This keeps the one-origin rule above. Don't point the frontend at the backend's own hostname instead, because that breaks cookies.
- **Database:** set `MONGO_URI` to the Atlas connection string. In Atlas's network access settings, allow only the backend's outbound IPs if the platform publishes them.

## Configuration reference

### Backend (set in `.env` or the platform's environment settings)

| Variable | Default | Set it to |
|---|---|---|
| `NODE_ENV` | — | `production` on any public deployment. Turns on Secure cookies and HSTS, and requires `SESSION_SECRET`. |
| `SESSION_SECRET` | dev placeholder | A long random string, e.g. `openssl rand -hex 32`. **Required in production.** Changing it logs everyone out. |
| `TRUST_PROXY` | unset | `1` when a reverse proxy or PaaS router terminates TLS in front of the backend. Without it, Express thinks every request is plain HTTP and won't send the Secure session cookie, so **login appears to work but the user is immediately logged out.** |
| `MONGO_URI` | `mongodb://localhost:27017` | Your Mongo connection string. |
| `DB_NAME` | `aquaponics_dev` | Use a distinct name per environment, e.g. `aquaponics_prod`. |
| `FRONTEND_ORIGIN` | localhost:5173 | Comma-separated list of origins allowed by CORS. Only matters if the API is ever called cross-origin; same-origin requests don't need it. |
| `SIGNUP_SECRET` | unset | Optional. If set, registering requires this code, which keeps a public URL from being open to anyone who finds it. Hand the code out to the class. If unset, the signup code field on the registration form is ignored. |

### Frontend dev server (only if running `vite` behind a proxy)

Prefer serving the built `dist/` in production (see below). If you must run the dev server behind a proxy, for example on a staging box where hot reload is useful:

| Variable | Purpose |
|---|---|
| `DEV_ALLOWED_HOSTS` | Comma-separated public hostnames. Vite rejects requests for hostnames it doesn't recognise. |
| `HMR_HOST`, `HMR_CLIENT_PORT`, `HMR_PROTOCOL` | Public host, port (e.g. `443`) and protocol (`wss`) the browser uses for the hot-reload websocket. |
| `API_PROXY_TARGET` | Where Vite forwards `/api`. Defaults to `http://localhost:4000`; `docker-compose.yml` sets `http://backend:4000`. |

## Production build vs. the dev server

`docker-compose.yml` runs the Vite **dev** server. That's convenient, but on a public host it:

- serves unminified source and source maps,
- uses far more memory and CPU than static files would,
- polls the filesystem for changes (the `usePolling` and `CHOKIDAR_*` settings).

For production:

```bash
cd FlowFarmFrontend
npm ci
npm run build        # outputs dist/
```

Then have the reverse proxy serve `dist/` directly, and fall back to `index.html` for unknown paths so client-side routes work. The backend still runs as a container, or under a process manager, with `NODE_ENV=production`.

## Example: Caddy

Caddy gets and renews a Let's Encrypt certificate automatically. It needs ports 80 and 443 open and a DNS name pointing at the server.

```caddyfile
game.example.org {
    encode gzip

    # API → backend
    handle /api/* {
        reverse_proxy 127.0.0.1:4000
    }

    # Everything else → built frontend
    handle {
        root * /srv/grow-n-flow/FlowFarmFrontend/dist
        try_files {path} /index.html
        file_server
    }

    # Optional: password-protect the whole site during a pilot.
    # Generate a hash with: caddy hash-password
    # basic_auth {
    #     teacher $2a$14$...hash...
    # }
}
```

Caddy sets `X-Forwarded-Proto` by default, so `TRUST_PROXY=1` is all the backend needs.

## Example: nginx

```nginx
server {
    listen 443 ssl http2;
    server_name game.example.org;
    # ssl_certificate / ssl_certificate_key from certbot or your IT group

    client_max_body_size 64k;   # moves are tiny; matches the backend's limit

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # required for login cookies
    }

    location / {
        root /srv/grow-n-flow/FlowFarmFrontend/dist;
        try_files $uri /index.html;
    }
}
```

Worth adding at the proxy:

- a rate limit on `/api/` (e.g. `limit_req`, about 5 r/s with a small burst),
- the security headers listed below.

## Game data and logs

### Where things are recorded

Gameplay is recorded in MongoDB, not in log files.

| Collection | What it holds | Identifies a person? |
|---|---|---|
| `users` | email, optional username, bcrypt password hash, account timestamps | **Yes, directly** |
| `sessions` | active login sessions: session ID (a live login token), user ID, email, username | **Yes, and the IDs can be used to log in as the user** |
| `matches` | one document per game: full game state (`G`: fish, plants, money, water chemistry, events, last action), turn info, timestamps, `ownerUserId` | Indirectly, via `ownerUserId` → `users` |
| `water_readings` | per-day snapshots of each match (water parameters, deaths, events), keyed by `matchID` | Indirectly, via the match |

Server output is secondary:

- **Backend output:** `docker compose logs backend` (or `podman compose logs backend`). It shows match IDs, game actions and errors. It doesn't print emails or usernames, so keep it that way when adding logging.
- **Reverse proxy access logs:** these record client IP addresses, plus the login name if you use basic auth. Treat them as personal data, rotate them, and don't share them.

### Getting the data out

`backend/scripts/db-dump.sh` makes a raw backup and, optionally, a pseudonymized export for analysis. It needs only Docker or Podman. The database tools run inside containers, and the pseudonymizing step runs in a throwaway container with no network access.

```bash
# Raw backup only. Contains emails and password hashes: treat as sensitive.
backend/scripts/db-dump.sh

# Backup + pseudonymized JSON for analysis
export REDACT_KEY=...   # see below
backend/scripts/db-dump.sh --redact

# Pseudonymized JSON only (raw backup deleted afterwards), plus a per-match summary
backend/scripts/db-dump.sh --redact --no-keep-raw --analyze

# Pseudonymize a backup made earlier
backend/scripts/db-dump.sh --redact --from ~/gnf-dumps/aquaponics_dev_....gz

# Podman instead of Docker
CONTAINER=podman backend/scripts/db-dump.sh --redact
```

Output goes to `~/gnf-dumps/` (change with `DUMP_DIR`). The script creates the directory with mode 700 and writes its files with mode 600.

### What the pseudonymized export contains

`backend/scripts/redact-export.js` works from an allowlist:

- **Only `users`, `matches` and `water_readings` are exported.** `sessions` is never exported. Any collection added later is skipped until someone adds it to the allowlist on purpose. The export header lists what was skipped.
- **`users` is reduced** to a pseudonym, account creation date and last login date. Email, username, password hash and exact times are dropped.
- **`matches`** keeps game state, turn info and timestamps, with the owner replaced by the same pseudonym, so games can be grouped by player.
- **`water_readings`** is kept as is; it contains simulation data only.
- **Pseudonyms are keyed:** `HMAC-SHA256(REDACT_KEY, user id)`, truncated to 12 hex characters.
  - The same player gets the same pseudonym in every export made with the same key, so you can follow a player across exports.
  - Without the key, a pseudonym can't be reversed. An unkeyed hash of an email address could be, simply by hashing every address on a class roster and comparing.

**Handling `REDACT_KEY`:**
- Generate it once with `openssl rand -hex 32`.
- Store it like a password, somewhere other than the dump directory.
- Never send it with an export.
- If you lose it, future exports will use new pseudonyms.
- If it leaks, rotate it. Exports made with the old key should then be treated as if they contained user IDs.

### What a keyed pseudonym does not do

A pseudonymized export is not an anonymous one. Even without names:

- In a small group, a distinctive game history or play times can still single someone out to anyone who knows when or how a particular person played.
- Match timestamps are kept at full precision because analysis needs them, for example to measure session length and time between turns.

So:
- Share exports only with people who need them.
- Delete raw backups and exports when you're done with them.
- When publishing results, report aggregates rather than per-player rows.

## Lessons from the first deployment

These caused real trouble or were caught in review:

1. **Hardcoded `http://localhost:4000` in the frontend.** It works on a developer laptop and breaks everywhere else. It is now relative URLs plus a proxy. Keep it that way: don't add absolute API URLs.
2. **Logins that didn't stick behind TLS.** The backend sat behind a proxy without `trust proxy`, so the Secure cookie was never sent. This is what `TRUST_PROXY=1` fixes.
3. **Ports published to the world.** The original compose file published Mongo (27017, no password) and the backend directly on all interfaces. On a server with a public IP, that puts the database on the internet. The compose file now binds to `127.0.0.1` and doesn't publish Mongo at all.
4. **Containers didn't come back after a crash or reboot.** Compose now sets `restart: unless-stopped`. On a server, also make sure the container runtime starts at boot: enable Docker's systemd service, or for rootless Podman, use quadlets or `podman generate systemd`.
5. **Vite rejected the public hostname.** The dev server only accepts hostnames it has been told about. This is what `DEV_ALLOWED_HOSTS` is for; serving `dist/` avoids it entirely.

## Before opening to the public

A checklist, roughly in priority order:

**Must do**
- [ ] HTTPS only, with `NODE_ENV=production`, a real `SESSION_SECRET`, and `TRUST_PROXY=1` if behind a proxy.
- [ ] Mongo isn't reachable from the internet. If it's on a shared network or Atlas, turn on authentication.
- [ ] Backups: run `backend/scripts/db-dump.sh` nightly (cron or a systemd timer) and copy the result somewhere off the server. Test a restore once.
- [ ] Decide who can register: set `SIGNUP_SECRET`, put basic auth at the proxy, or accept open signup knowingly.
- [ ] If students use it, check your institution's rules on storing student data before picking a hosting provider.

**Should do**
- [ ] Serve the built frontend instead of the Vite dev server.
- [ ] Rate-limit `/api/` at the proxy.
- [ ] Validate the type and range of numeric move arguments on the backend. Today most are limited only indirectly (for example, `addFish` quantity is capped by the player's money), so a tampered request could still send unexpected values.
- [ ] Generate match IDs with `crypto.randomUUID()` instead of `Math.random()` (`backend/src/api/matchHandler.js`) so they can't be guessed.
- [ ] Log rotation for container logs (`logging:` options in compose, or the daemon's defaults) so long uptimes don't fill the disk.
- [ ] Memory and CPU limits on containers so one runaway process can't take the server down.
- [ ] Run `backend/scripts/createIndexes.js` (or equivalent) on a fresh database.

**Nice to have**
- [ ] Check the HSTS header in `backend/src/app.js` (`includeSubDomains; preload`). This is a commitment that applies to **every subdomain** of the host for two years. On a shared university domain, drop `includeSubDomains; preload`, or let the proxy set HSTS instead.
- [ ] Add a Content-Security-Policy. Note that `X3DViewer.jsx` loads `x3dom.js` from `www.x3dom.org` at runtime, so the CSP must allow that origin. Better still, vendor the file into `public/` so the site doesn't depend on a third-party script.
- [ ] Remove the unused `boardgame.io` dependency from the frontend; it's large.
