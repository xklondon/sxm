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
#   Leave PUBLIC_ORIGIN / CORS_ORIGIN as-is — `npm run host` overrides them
#   with your detected LAN IP automatically. Set a strong SESSION_SECRET.

# 6. Build the app once
npm run build
```

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

## One-tap launcher (Termux:Widget)

Add a home-screen button that starts the host, keeps the phone awake, and opens
the game — all from one tap.

The launcher script lives in the repo at `scripts/android/start-sxm-host.sh`. It:

1. opens the existing server if one is already running (no duplicate hosts);
2. `cd ~/sxm`, warns if the working tree is dirty (but continues);
3. runs `npm run build` if `dist/index.html` is missing;
4. takes a `termux-wake-lock` (if available) to keep the phone awake;
5. starts `npm run host`, logging to `~/sxm-host.log`;
6. reads the LAN URL from `/api/host/status` and prints the server info + QR;
7. opens the browser with `termux-open-url http://<ip>:5173`.

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
| Phone says no LAN IP | Connect to Wi-Fi or enable the hotspot, then re-run. |
| Players can't connect | Confirm they're on the **same** Wi-Fi/hotspot. Some "guest" Wi-Fi networks block device-to-device traffic — use a hotspot instead. |
| QR doesn't render | Your terminal font may not support block glyphs; type the printed `Address:` manually. |
| Widget does nothing / `curl not found` | `pkg install curl`. The launcher needs curl to detect/query the server. |
| Browser doesn't open | Install **Termux:API** (`pkg install termux-api`); otherwise open the printed URL manually. |
| Widget not listed | Install **Termux:Widget** from F-Droid and make sure the script is at `~/.shortcuts/SXM Cards` and `chmod +x`. |
| Tapped twice | Safe — the launcher detects the running server and just reopens the URL (no duplicate host). |

## Notes

- `npm run host` and the launcher never write your `.env` (read-only, like `npm run dev`).
- The host serves the built SPA **and** API **and** Socket.IO on one port
  (`5173`), bound to `0.0.0.0`, so any device on the LAN can reach it.
- The launcher logs to `~/sxm-host.log` (outside the repo — nothing secret is
  committed). The host keeps running after the launcher exits; release the wake
  lock with `termux-wake-unlock` when you're done hosting.
- Cloud deployment is unaffected — production still uses `PUBLIC_ORIGIN` and
  `NODE_ENV=production` (see `DEPLOYMENT.md`).
