# Hosting SXM CARDS on Android (Termux)

Turn an Android phone into the SXM CARDS game server. Friends on the **same
Wi-Fi or your phone's hotspot** join by scanning a QR code — virtual chips only,
no real-money anything.

## Requirements

- Android device with [Termux](https://f-droid.org/en/packages/com.termux/)
  (install from F-Droid; the Play Store build is outdated).
- All players on the **same network** as the host phone (home Wi-Fi or the
  host phone's hotspot).
- Node 20+ (Node 22 recommended).

## One-time setup

```sh
# 1. Update Termux packages
pkg update

# 2. Install Node.js, git, curl (curl is used by the one-tap launcher)
pkg install nodejs git curl

# 3. Get the code (clone into ~/sxm — the launcher's default directory)
git clone <REPO_URL> ~/sxm
cd ~/sxm

# 4. Install dependencies (uses package-lock.json)
npm ci

# 5. Create your .env (copy the example, then edit values)
cp .env.example .env
#   IMPORTANT: keep .env free of LAN IPs. Host mode auto-detects your current IP
#   every launch and ignores PUBLIC_ORIGIN / CORS_ORIGIN / VITE_API_URL /
#   VITE_TABLE_HOST. Set a strong SESSION_SECRET and your SMTP/email values.

# 6. Build the app once
npm run build
```

### Keep IPs out of `.env`

Your phone's IP changes whenever you switch hotspot/Wi-Fi. **Do not** pin IPs in
`.env` — host mode detects the current IP on every launch. A clean Termux `.env`
should contain only **stable** config:

```sh
# --- Stable config only (no IPs!) ---
SESSION_SECRET=generate-a-long-random-secret
ROOT_USER_EMAIL=you@gmail.com
INVITE_ONLY_MODE=true
VITE_ONLINE_MODE=true

# --- Email / SMTP (optional, for magic-link invites) ---
EMAIL_INVITES=true
VITE_EMAIL_INVITES=true
EMAIL_FROM=you@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your-gmail-app-password
```

Host mode (`npm run host` / the widget) sets these automatically each run, so you
never edit them by hand:

```
PUBLIC_ORIGIN=http://<detected-ip>:<port>
CORS_ORIGIN=http://<detected-ip>:<port>
VITE_API_URL=         # blank → client uses the page origin (current IP)
VITE_TABLE_HOST=      # blank → invite links use the page origin
SXM_SERVE_STATIC=true
SXM_HOST_MODE=true
API_HOST=0.0.0.0
PORT=<host-port>
```

> If you previously baked a LAN IP into `.env`, remove those lines and rebuild
> **once** so the bundle stops targeting the old IP:
> `rm -rf dist && npm run build`. After that, IP changes need no rebuild.

> Tip: keep the phone awake while hosting — `pkg install termux-services` or
> Android's "stay awake" developer setting helps. To prevent Termux being
> killed in the background, run `termux-wake-lock`.

## Start hosting

```sh
npm run host
```

You'll see:

```
SXM CARDS SERVER

Running
Address: http://<local-ip>:5173

Players: 0

QR:
<scannable QR code>
```

Players scan the QR (or type the address) to join. The same address and a live
player count + QR are also available in-app under **Settings → Host Server**.

### When your IP changes (new hotspot / Wi-Fi)

Nothing to edit. Just **stop the server (Ctrl-C) and run `npm run host` again**,
or **re-tap the "SXM Cards" widget**. Host mode re-detects the IP, rewrites the
join address, and prints a fresh QR. The current address is also written to
`.sxm-host-runtime.json` (gitignored) for tooling.

## One-tap launcher (Termux:Widget)

Add a home-screen button that starts the host, keeps the phone awake, and opens
the game — all from one tap.

The launcher script lives in the repo at `scripts/android/start-sxm-host.sh`. It:

1. opens the existing server if one is already running (no duplicate hosts);
2. `cd ~/sxm`, warns if the working tree is dirty (but continues);
3. runs an IP-agnostic `npm run build` if `dist/index.html` is missing;
4. takes a `termux-wake-lock` (if available) to keep the phone awake;
5. starts `npm run host`, logging to `~/sxm-host.log`;
6. reads the effective LAN URL from `/api/host/status` (never from `.env`) and
   prints the server info + QR;
7. opens the browser at that detected join address with `termux-open-url`.

### Set it up

```sh
# Install the helper apps (from F-Droid):
#   - Termux:Widget   https://f-droid.org/en/packages/com.termux.widget/
#   - Termux:API      https://f-droid.org/en/packages/com.termux.api/
pkg install termux-api

# Create the shortcuts folder Termux:Widget reads from
mkdir -p ~/.shortcuts

# Copy the launcher in and name it "SXM Cards"
cp ~/sxm/scripts/android/start-sxm-host.sh "$HOME/.shortcuts/SXM Cards"

# Make it executable
chmod +x "$HOME/.shortcuts/SXM Cards"
```

Then, on the Android home screen: **long-press → Widgets → Termux:Widget**, drop
it on the home screen, and **tap "SXM Cards"**. The server starts and the browser
opens automatically.

> The launcher uses `~/sxm` by default. If you cloned elsewhere, run it with
> `SXM_DIR=/path/to/repo` (or a different port via `HOST_PORT=8080`).

### Manual fallback (no widget)

```sh
cd ~/sxm
bash scripts/android/start-sxm-host.sh
```

## Updating to a new version

```sh
cd ~/sxm
git pull
npm ci
npm run build
npm run host   # or just tap the "SXM Cards" widget
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `No build found at dist/` | Run `npm run build` first. |
| `Server did not become ready … already in use` | Another process holds port 5173. Stop it, or set `HOST_PORT=8080 npm run host`. |
| Must magic-link login every visit on phone | Use **one** join URL consistently (the printed `Address:` / QR). `http://127.0.0.1:5173` and `http://10.x.x.x:5173` are different origins — cookies do not cross. Check **Remember me** when signing in; host mode keeps the session cookie on HTTP (no `Secure` flag). |
| Phone says no LAN IP | Connect to Wi-Fi or enable the hotspot, then re-run. |
| Players can't connect | Confirm they're on the **same** Wi-Fi/hotspot. Some "guest" Wi-Fi networks block device-to-device traffic — use a hotspot instead. |
| App opens but stays blank / "loading" after an IP change | Old IP baked into the build. Remove IP lines from `.env`, then `rm -rf dist && npm run build` once. Restart the widget. |
| Blank / green screen right after a rebuild | The browser cached the old `index.html` pointing at an old asset name. Stale assets now return **404** (not HTML), and `index.html` is sent `no-store`, so a plain refresh usually fixes it. If not, clear the site's data, or load `http://<ip>:5173/?fresh=1`. |
| Blank / green screen that a refresh doesn't fix | Open the diagnostics: **`http://<ip>:5173/debug/client-config`** (no login needed). `apiBase`/`socketBase` should equal the page origin and `VITE_API_URL`/`VITE_TABLE_HOST` should be `(blank)`. If the boot stalls >5s an overlay lists which boot stage was reached; any JS error renders visible text instead of green. |
| QR doesn't render | Your terminal font may not support block glyphs; type the printed `Address:` manually. |
| Widget does nothing / `curl not found` | `pkg install curl`. The launcher needs curl to detect/query the server. |
| Browser doesn't open | Install **Termux:API** (`pkg install termux-api`); otherwise open the printed URL manually. |
| Widget not listed | Install **Termux:Widget** from F-Droid and make sure the script is at `~/.shortcuts/SXM Cards` and `chmod +x`. |
| Tapped twice | Safe — the launcher detects the running server and just reopens the URL (no duplicate host). |

## Notes

- `npm run host` and the launcher never write your `.env` (read-only, like `npm run dev`).
- Host mode (`SXM_HOST_MODE=true`) always derives the join address from the
  **detected IP**, overriding any stale `PUBLIC_ORIGIN`/`CORS_ORIGIN` in `.env`,
  and writes the current address to `.sxm-host-runtime.json` (gitignored).
- The host serves hashed assets under `/assets/*` as cacheable + immutable, but
  `index.html` is `no-store`. Missing/old assets return **404** (never the SPA
  shell), so a stale cache fails loudly with a refresh hint instead of a blank
  screen.
- Boot diagnostics are always on: visit `/debug/client-config` to see the live
  `apiBase`/`socketBase`/env, a >5s stall shows a "Still loading…" overlay with
  the last boot stage, and any uncaught/render error paints visible text over
  the green felt instead of a silent blank screen.
- Desktop dev and Termux host share one **single-origin** model: the SPA, `/api`,
  and `/socket.io` all live on the page origin (Vite proxies them in dev; Express
  serves them directly in host mode). The client derives `apiBase`/`socketBase`
  from `window.location.origin` whenever `VITE_API_URL` is blank — so there are
  no baked LAN IPs and `.env` never needs a current IP.
- The host serves the built SPA **and** API **and** Socket.IO on one port
  (`5173`), bound to `0.0.0.0`, so any device on the LAN can reach it.
- The launcher logs to `~/sxm-host.log` (outside the repo — nothing secret is
  committed). The host keeps running after the launcher exits; release the wake
  lock with `termux-wake-unlock` when you're done hosting.
- Cloud deployment is unaffected — production still uses `PUBLIC_ORIGIN` and
  `NODE_ENV=production` (see `DEPLOYMENT.md`).
- **Sign-in URL:** Always open the same address you used to request the magic link
  (QR / printed `Address:`). Loopback (`127.0.0.1`) and LAN IP (`10.x.x.x`) store
  separate cookies. Enable **Remember me** for a persistent session until
  `SESSION_MAX_AGE_MS` expires.
