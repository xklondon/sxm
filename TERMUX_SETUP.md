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

# 2. Install Node.js + git
pkg install nodejs git

# 3. Get the code
git clone <REPO_URL> sxmcards
cd sxmcards

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

## Updating to a new version

```sh
cd sxmcards
git pull
npm ci
npm run build
npm run host
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `No build found at dist/` | Run `npm run build` first. |
| `Server did not become ready … already in use` | Another process holds port 5173. Stop it, or set `HOST_PORT=8080 npm run host`. |
| Phone says no LAN IP | Connect to Wi-Fi or enable the hotspot, then re-run. |
| Players can't connect | Confirm they're on the **same** Wi-Fi/hotspot. Some "guest" Wi-Fi networks block device-to-device traffic — use a hotspot instead. |
| QR doesn't render | Your terminal font may not support block glyphs; type the printed `Address:` manually. |

## Notes

- `npm run host` never writes your `.env` (read-only, like `npm run dev`).
- The host serves the built SPA **and** API **and** Socket.IO on one port
  (`5173`), bound to `0.0.0.0`, so any device on the LAN can reach it.
- Cloud deployment is unaffected — production still uses `PUBLIC_ORIGIN` and
  `NODE_ENV=production` (see `DEPLOYMENT.md`).
