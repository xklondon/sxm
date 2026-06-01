#!/usr/bin/env bash
#
# SXM Cards — Termux:Widget one-tap launcher.
#
# Starts the SXM Cards host server (unless one is already running), keeps the
# phone awake, opens the browser to the detected LAN game URL, and prints the
# server info + QR. Safe to tap repeatedly — it will not start a second server.
#
# Virtual chips only. Never writes .env (delegates to `npm run host`, which is
# read-only). Logs to ~/sxm-host.log.
#
# Manual fallback:
#   cd ~/sxm
#   bash scripts/android/start-sxm-host.sh
#
# Overridable via env: SXM_DIR, HOST_PORT, SXM_LOG, SXM_READY_TIMEOUT.

set -u

SXM_DIR="${SXM_DIR:-$HOME/sxm}"
PORT="${HOST_PORT:-5173}"
LOG="${SXM_LOG:-$HOME/sxm-host.log}"
READY_TIMEOUT="${SXM_READY_TIMEOUT:-60}"
STATUS_URL="http://127.0.0.1:${PORT}/api/host/status"

log() { printf '[sxm] %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

# curl is needed to query the server and to detect an already-running host.
if ! have curl; then
  log "curl not found. Install it with: pkg install curl"
  exit 1
fi

fetch_status() { curl -fsS --max-time 2 "$STATUS_URL" 2>/dev/null; }

# Extract "joinAddress":"http://ip:port" from the status JSON without jq.
join_url_from_status() {
  printf '%s' "$1" | sed -n 's/.*"joinAddress":"\([^"]*\)".*/\1/p'
}

open_url() {
  url="$1"
  if have termux-open-url; then
    termux-open-url "$url"
    log "Opened $url"
  else
    log "termux-open-url not found (install Termux:API). Open manually: $url"
  fi
}

# 1. If a host is already running on this port, just open the URL — no duplicate.
existing="$(fetch_status || true)"
if printf '%s' "$existing" | grep -q '"status":"running"'; then
  url="$(join_url_from_status "$existing")"
  [ -n "$url" ] || url="http://127.0.0.1:${PORT}"
  log "SXM host already running — opening existing server."
  open_url "$url"
  exit 0
fi

# 2. Move into the project directory.
if [ ! -d "$SXM_DIR" ]; then
  log "Project not found at $SXM_DIR. Clone into ~/sxm or set SXM_DIR."
  exit 1
fi
cd "$SXM_DIR" || { log "Cannot cd into $SXM_DIR"; exit 1; }

# 3. Warn (but continue) if the working tree has uncommitted changes.
if have git && [ -d .git ]; then
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    log "WARNING: working tree is dirty (uncommitted changes) — continuing anyway."
  fi
fi

# 4. Build the SPA once if there is no build yet.
if [ ! -f dist/index.html ]; then
  log "No build found — running 'npm run build' (first launch can take a while)…"
  if ! npm run build >>"$LOG" 2>&1; then
    log "Build failed. See $LOG"
    exit 1
  fi
fi

# 5. Keep the phone awake while hosting (best effort).
if have termux-wake-lock; then
  termux-wake-lock && log "Wake lock acquired (termux-wake-unlock to release)."
fi

# 6. Start the host server in the background, capturing output to the log.
log "Starting SXM host… (log: $LOG)"
: >"$LOG"
nohup npm run host >>"$LOG" 2>&1 &
HOST_PID=$!
log "Host PID: $HOST_PID"

# 7. Wait until the server answers /api/host/status.
url=""
elapsed=0
while [ "$elapsed" -lt "$READY_TIMEOUT" ]; do
  status="$(fetch_status || true)"
  if printf '%s' "$status" | grep -q '"status":"running"'; then
    url="$(join_url_from_status "$status")"
    break
  fi
  sleep 1
  elapsed=$((elapsed + 1))
done

if [ -z "$url" ]; then
  log "Server did not become ready in ${READY_TIMEOUT}s. See $LOG"
  exit 1
fi
[ -n "$url" ] || url="http://127.0.0.1:${PORT}"

# 8. Print server info + QR (from the host banner), then open the browser.
banner_wait=0
while [ "$banner_wait" -lt 10 ]; do
  grep -q "SXM CARDS SERVER" "$LOG" 2>/dev/null && break
  sleep 1
  banner_wait=$((banner_wait + 1))
done

log "SXM host ready at $url"
echo
echo "============ SXM CARDS SERVER ============"
sed -n '/SXM CARDS SERVER/,$p' "$LOG" | head -n 40
echo "=========================================="
echo

open_url "$url"
