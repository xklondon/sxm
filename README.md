# SXMCARDS

Online blackjack/card table app with magic-link auth and multiplayer WebSocket sync.

**Product specification:** [docs/SXM_MASTER_SPEC.md](./docs/SXM_MASTER_SPEC.md) — single source of truth for current behavior.  
**Architecture (V1.0):** [docs/SXM_ARCHITECTURE.md](./docs/SXM_ARCHITECTURE.md) — routes, layers, CSS ownership.  
**Change log:** [docs/CHANGE_LOG.md](./docs/CHANGE_LOG.md)

## Local development

### Topology (dev)

| Role | URL | Notes |
|------|-----|--------|
| **Frontend (public)** | `http://192.168.0.56:5173` | Vite — use this on phone/LAN |
| **API (internal)** | `http://127.0.0.1:3017` (or next free port) | Not exposed on LAN; proxied by Vite |
| **WebSocket** | `http://192.168.0.56:5173/socket.io` | Proxied to internal API |

Port **5173** is reserved for SXM Casino. Port **3001** is intentionally unused (often taken by other apps). The dev orchestrator auto-picks `3017`, `5180`, etc. if the configured `API_PORT` is busy.

### Setup

```bash
cp .env.example .env   # first time only — then edit .env locally
# Edit .env: set your LAN IP if not 192.168.0.56; add SMTP secrets manually

npm install
npm run dev
```

**Env safety:** Scripts never overwrite `.env`. Missing keys are reported with instructions. See `scripts/envGuard.ts`. Do not commit `.env` or put secrets in `.env.example`.

Startup logs:

```
[SXM] Frontend: http://192.168.0.56:5173
[SXM] API: http://127.0.0.1:3017 (internal — proxied at …/api)
[SXM] Public origin: http://192.168.0.56:5173
[SXM] WebSocket: http://192.168.0.56:5173/socket.io (via Vite proxy)
```

### Phone testing

Open **`http://192.168.0.56:5173`** on a device on the same Wi‑Fi (replace with your machine's LAN IP).

All magic links, invite links, session cookies, and WebSocket traffic use that single origin — no localhost in URLs.

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Frontend + API (recommended) |
| `npm run dev:vite` | Vite only (needs API running separately) |
| `npm run dev:server` | API only |
| `npm run check:auth` | Auth/email/origin readiness audit |
| `npm run build` | Production frontend build |
| `npm run test` | Unit + server tests |
| `npm run test:local-flow` | Origin + auth + table flow (requires `npm run dev`) |

### Environment

**Dev origin (magic/invite links):** set `DEV_PUBLIC_ORIGIN=auto` so links always use the detected LAN IP (`http://192.168.x.x:5173`). Browse locally at `http://localhost:5173` — API calls use the Vite proxy. Phone/friends use the LAN URL from startup logs. `.env` is never overwritten.

Browser-facing URLs:

- `PUBLIC_ORIGIN` — reference value in `.env` (localhost in dev)
- `CORS_ORIGIN` — comma-separated allowed origins (localhost + LAN both OK in dev)

**API calls in dev:** leave `VITE_API_URL` empty. The browser uses same-origin `/api/...` via the Vite proxy.

Internal only:

- `API_PORT` — preferred internal port (default `3017`)
- `API_HOST` — `127.0.0.1` in dev
- `ROOT_USER_EMAIL` — always allowed to request magic links; auto-created as root on first login
- `INVITE_ONLY_MODE` — when `true` (default), only root and invited people can sign in

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production/AWS.
