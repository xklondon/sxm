# SXMCARDS deployment

## Recommended AWS layout

**Preferred:** single Node service (AWS App Runner or ECS/Fargate) serving:

- REST API (`/api/*`)
- WebSocket (Socket.IO on same origin)
- static Vite build (`dist/`)

This avoids WebSocket/proxy issues common with Amplify-only static hosting.

| Option | Frontend | Backend + WS | Notes |
|--------|----------|--------------|-------|
| **A — App Runner (recommended)** | Same service | Same service | Simplest full-stack deploy |
| **B — Amplify + App Runner** | Amplify | App Runner API | Set `VITE_API_URL` to API URL |
| **C — ECS/Fargate** | Same or S3+CloudFront | ECS service | Use when you need VPC/custom scaling |

## Build

```bash
npm ci
npm run build:all
```

Production start:

```bash
NODE_ENV=production PUBLIC_ORIGIN=https://your-domain.example npm run start:prod
```

**Railway:** see [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md) for build/start commands, env vars, and smoke checklist.

The server serves `dist/` when `NODE_ENV=production`.

## Health check

```
GET /health
→ { "ok": true, "service": "sxmcards-api", "env": "production" }
```

Configure App Runner / load balancer health checks against `/health`.

## Environment variables (production)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NODE_ENV` | yes | `production` |
| `PUBLIC_ORIGIN` | yes | Public app URL (no localhost/LAN) |
| `CORS_ORIGIN` | yes | Same as public origin if single-host |
| `SESSION_SECRET` | yes | Strong random secret |
| `DATABASE_URL` | yes (production) | Postgres URL — durable people, users, magic links, invites. Omit locally for MemoryStore. |
| `SMTP_HOST`, `EMAIL_FROM` | yes | Magic links + email invites |
| `ROOT_USER_EMAIL` | yes | Bootstrap admin; always allowed to sign in |
| `INVITE_ONLY_MODE` | optional | Default `true` — reject unknown emails at magic-link request |
| `PORT` | optional | Set by Railway/App Runner; defaults to `3017` locally if unset |

Frontend build-time (if separate Amplify build):

| Variable | Purpose |
|----------|---------|
| `VITE_ONLINE_MODE=true` | Enable auth + multiplayer |
| `VITE_API_URL` | API origin (omit if same host) |
| `VITE_EMAIL_INVITES=true` | Show email invite UI |

## Deployment checklist

- [ ] `PUBLIC_ORIGIN` is your production domain (not localhost / 192.168.x)
- [ ] `SESSION_SECRET` rotated from dev default
- [ ] SMTP configured and magic link email tested
- [ ] `npm run build:all` succeeds
- [ ] `/health` returns 200
- [ ] Magic link login works end-to-end
- [ ] `ROOT_USER_EMAIL` set to your admin email (first login creates immutable root person)
- [ ] Invite-only login: add people via **People admin** or table invite-by-email before they can sign in
- [ ] Create table → invite link uses production domain
- [ ] Two browsers: join + synchronized bet/deal/hit via WebSocket
- [ ] WebSocket connects through load balancer (App Runner supports this on same service)

## Local full-stack dev

```bash
cp .env.example .env
npm run dev
```

- **Public (phone/LAN):** `http://192.168.0.56:5173` — Vite frontend + proxied `/api` + `/socket.io`
- **Internal API:** `127.0.0.1:3017` (or next free port if busy) — not used by browsers
- Port **3001** is avoided (commonly occupied by other apps)
- Without SMTP, magic links print to the API console and appear in the login UI dev helper.

## People & permissions

- **Storage:** in-memory people directory on the API server (same persistence style as tables/sessions; restart clears data unless you add external storage later).
- **Root user:** `ROOT_USER_EMAIL` can always request a magic link, even before a person record exists. First successful login creates a root person with full permissions. Root cannot be disabled or demoted via API/UI.
- **Roles:** `root`, `admin`, `host`, `player`, `guest` — with `canOwnTables`, `canPlay`, `canInvite`, `canLogin` flags.
- **Admin UI:** `/` → **People** (visible to root/admin) — list, add, edit roles/permissions, resend magic link, disable users.
- **Table invite by email:** `POST /api/tables/:tableId/invite-person` creates the person if missing, enables login, sends join email (or copyable link when SMTP unavailable).

See [README.md](./README.md) for full local topology.

## App Runner sketch

1. Build container or use source deploy with `npm run build:all && npm run start:server`
2. Set env vars above
3. Port = `3001` (or `PORT` you configure)
4. Health check path `/health`

## Amplify + separate API

1. Deploy API to App Runner with `PUBLIC_ORIGIN=https://app.example.com`
2. Amplify build: `VITE_ONLINE_MODE=true`, `VITE_API_URL=https://api.example.com`
3. Enable CORS on API for Amplify origin
4. Ensure cookies: same-site policies if cross-origin (prefer single domain)
