# Deploy SXM Cards on Railway

One Node process serves everything on a single public HTTPS URL:

- Vite SPA (`dist/`)
- REST API (`/api/*`)
- Socket.IO (`/socket.io`, WebSocket upgrade on the same host)

No separate frontend host. Leave `VITE_API_URL` and `VITE_TABLE_HOST` **blank** so the browser uses same-origin `/api` and `/socket.io`.

## Limits (read before scaling)

| Topic | Current behavior |
|--------|------------------|
| **Instances** | Use **one Railway service instance** only. Table sessions, people, and magic links live in **in-memory** store — data is not shared across replicas. |
| **Redis** | Not used yet. Restart or redeploy clears in-memory state unless you add external persistence later. |
| **Autoscaling** | Do not enable horizontal autoscaling until shared storage exists. Multiple instances will split users across disjoint game state. |

## 1. Create the Railway project

1. Open [Railway](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
2. Select this repository (`SXMCards`).
3. Railway detects Node.js from `package.json`.

## 2. Build and start commands

In the service **Settings** → **Deploy**:

| Setting | Value |
|---------|--------|
| **Build command** | `npm ci && npm run build` |
| **Start command** | `npm run start:prod` |

What this does:

- **Build:** Typecheck + `vite build` → `dist/` (client bundle).
- **Start:** `tsx server/src/index.ts` — Express + Socket.IO on `process.env.PORT` (Railway sets `PORT` automatically; do not hardcode it in env unless you know why).

`NODE_ENV=production` turns on static serving from `dist/`, `0.0.0.0` bind, and production cookie/CORS rules.

## 3. Health check

In **Settings** → **Healthcheck** (or service health probe):

| Field | Value |
|-------|--------|
| **Path** | `/health` |
| **Timeout** | 100–300 s (first deploy may be slow while `npm ci` runs) |

Equivalent checks:

```bash
curl -sS https://<your-railway-domain>/health
curl -sS https://<your-railway-domain>/api/health
```

Both should return JSON like `{"ok":true,"service":"sxmcards-api","env":"production"}`.

## 4. Public domain

1. Service → **Settings** → **Networking** → **Generate Domain** (e.g. `sxmcards-production.up.railway.app`).
2. Use that **HTTPS** URL everywhere below as `<railway-domain>`.

## 5. Environment variables

Set in Railway **Variables** (available at **build** and **runtime** for `VITE_*`).

Replace placeholders. Do not commit secrets to git.

### Required

| Variable | Example / notes |
|----------|-----------------|
| `NODE_ENV` | `production` |
| `PUBLIC_ORIGIN` | `https://<railway-domain>` — magic links and redirects (no trailing slash) |
| `CORS_ORIGIN` | `https://<railway-domain>` — same as `PUBLIC_ORIGIN` for single-host deploy |
| `SESSION_SECRET` | Long random string (rotate from dev default) |
| `ROOT_USER_EMAIL` | Your admin email (always allowed to request magic link) |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Gmail address |
| `SMTP_PASS` | Gmail [app password](https://support.google.com/accounts/answer/185833) |
| `EMAIL_FROM` | `SXM Casino <you@gmail.com>` |

### Recommended

| Variable | Value |
|----------|--------|
| `SESSION_MAX_AGE_MS` | `604800000` (7 days) |
| `INVITE_ONLY_MODE` | `true` |
| `EMAIL_INVITES` | `true` |
| `VITE_ONLINE_MODE` | `true` |
| `VITE_EMAIL_INVITES` | `true` (or rely on `EMAIL_INVITES` at runtime for server; set both for UI) |

### Same-origin client (required for single Railway URL)

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | *(leave empty)* |
| `VITE_TABLE_HOST` | *(leave empty)* |

### Do not set on Railway (unless debugging)

| Variable | Why |
|----------|-----|
| `PORT` | Injected by Railway — server reads `process.env.PORT` |
| `SXM_HOST_MODE` | Termux/LAN host only |
| `DEV_PUBLIC_ORIGIN` | Dev only; must not be `auto` in production |
| `API_PORT` | Dev internal port; production uses `PORT` |

`SMTP_SECURE` is not read by the app; port `587` uses STARTTLS (`secure: false` in nodemailer). Use port `465` only if you intentionally want implicit TLS.

### Example block (copy and edit)

```env
NODE_ENV=production
PUBLIC_ORIGIN=https://<railway-domain>
CORS_ORIGIN=https://<railway-domain>
SESSION_SECRET=<long-random-secret>
SESSION_MAX_AGE_MS=604800000
ROOT_USER_EMAIL=xklondon@gmail.com
INVITE_ONLY_MODE=true
EMAIL_INVITES=true
VITE_ONLINE_MODE=true
VITE_API_URL=
VITE_TABLE_HOST=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=xklondon@gmail.com
SMTP_PASS=<gmail-app-password>
EMAIL_FROM=SXM Casino <xklondon@gmail.com>
```

After changing `VITE_*`, trigger a **redeploy** so `npm run build` bakes the new values into `dist/`.

## 6. Verify deploy

### Automated / CLI

```bash
# Health
curl -sS "https://<railway-domain>/health"
curl -sS "https://<railway-domain>/api/health"

# SPA shell (no-store)
curl -sSI "https://<railway-domain>/" | findstr /i "HTTP cache"

# Client config page (no login)
curl -sS "https://<railway-domain>/debug/client-config"
```

Expect on `/debug/client-config` (in browser):

- `apiBase` and `socketBase` equal `https://<railway-domain>`
- `VITE_API_URL` and `VITE_TABLE_HOST` show `(blank)`

### Magic-link email (SMTP)

Backend diagnostics (JSON, not the frontend `/debug/client-config` page):

```bash
curl -sS "https://<railway-domain>/api/debug/email-config"
```

Expect `smtpConfigured: true`, `smtpHost`, `smtpPort`, `smtpSecure`, `smtpUserPresent`, `smtpPassPresent`, and `publicOrigin` with `https://`.

Optional live send test (set `DEBUG_EMAIL_TEST=true` on Railway, then remove after debugging):

```bash
curl -sS -X POST "https://<railway-domain>/api/debug/send-test-email" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@gmail.com"}'
```

After requesting a magic link, inspect **Deploy Logs** for lines prefixed `[SXM][auth]` and `[SXM][email]` (see project docs — no secrets in logs).

Verbose API errors: set `DEBUG_EMAIL_VERBOSE=true` temporarily (returns SMTP error detail in JSON).

### Socket.IO

In browser DevTools → **Network** → filter `socket.io`:

- After login, connection should be `wss://<railway-domain>/socket.io/...` with status **101** (WebSocket) or successful polling then upgrade.

Quick CLI (polling transport only):

```bash
curl -sS "https://<railway-domain>/socket.io/?EIO=4&transport=polling"
```

Should return a Socket.IO handshake payload (not HTML).

## 7. Smoke test checklist

Run on the production URL with two browsers (or normal + private window).

- [ ] **Health:** `/health` and `/api/health` return `ok: true`
- [ ] **Client config:** `/debug/client-config` shows same-origin `apiBase` / `socketBase`, blank `VITE_API_URL`
- [ ] **Login:** Request magic link → email arrives → link opens app → session persists (Remember me)
- [ ] **Create table:** Logged-in user creates a table
- [ ] **Invite:** Owner sends invite (email or copy link); guest opens link on same `<railway-domain>`
- [ ] **WebSocket sync:** Guest joins; both see table updates without manual refresh
- [ ] **Bet:** Place bet on a box (both clients see stake)
- [ ] **Deal / play:** Deal round; hit/stand on active hand; state stays in sync
- [ ] **Redeploy awareness:** Note that redeploy clears in-memory tables/sessions until Redis/external store exists

## 8. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build fails on `tsc` / `vite` | Check build logs; ensure Node ≥ 20 in Railway |
| `PUBLIC_ORIGIN must not be localhost/LAN` | Set `PUBLIC_ORIGIN` / `CORS_ORIGIN` to the Railway HTTPS domain |
| Magic link points to wrong host | `PUBLIC_ORIGIN` must match the URL users open |
| Login works but WebSocket fails | Confirm single origin; `VITE_API_URL` must be blank; check Railway supports WebSockets (default on) |
| Cookies not sticking | Use HTTPS domain only; do not mix `www` and non-`www` |
| Empty app after deploy | Open `/debug/client-config`; stale asset → hard refresh or clear site data |
| Tables disappear after deploy | Expected with in-memory store — one instance, no persistence yet |

## Related docs

- [DEPLOYMENT.md](./DEPLOYMENT.md) — general production / AWS notes
- [TERMUX_SETUP.md](./TERMUX_SETUP.md) — LAN host mode (not Railway)
