#!/bin/bash
# Runs the Cloudflare quick tunnel for the local FastAPI backend and keeps
# mobile/src/constants.ts pointed at whatever URL it gets assigned.
#
# This exists because a stable, permanent hostname requires a domain in a
# Cloudflare account (DNS-routed named tunnel) — see README.md's Cloudflare
# Tunnel section for why. Without a domain, the best available fix is: keep
# the tunnel itself always running (via launchd, see
# com.jinvani.cloudflared-tunnel.plist) and stop requiring a human to notice
# the URL changed and hand-edit constants.ts.
#
# Managed by launchd (~/Library/LaunchAgents/com.jinvani.cloudflared-tunnel.plist).
# Not meant to be run manually except for debugging.
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONSTANTS_FILE="$REPO_DIR/mobile/src/constants.ts"
LOG_DIR="$HOME/Library/Logs/jinvani-cloudflared"
LOG_FILE="$LOG_DIR/cloudflared.log"
# Truncated fresh on every restart, unlike LOG_FILE (append-only history) —
# URL detection below greps this one so a URL left over from a *previous*
# run can never be mistaken for this run's freshly-assigned one.
RUN_LOG_FILE="$LOG_DIR/current-run.log"
BACKEND_PORT=8000

mkdir -p "$LOG_DIR"
: > "$RUN_LOG_FILE"
echo "$(date '+%Y-%m-%d %H:%M:%S') — starting cloudflared quick tunnel" >> "$LOG_FILE"

# --protocol http2 forces TCP transport instead of cloudflared's default
# QUIC (which runs over UDP). Needed on networks that block/drop outbound
# UDP (seen on this network — cloudflared's own precheck logs showed
# "no route to host" / "no recent network activity" specifically on the
# QUIC dial, while plain TCP/HTTP2 connects fine). --protocol isn't
# listed in `cloudflared tunnel --help` in this version but is accepted —
# confirmed via a real connection using it. See README.md's Cloudflare
# Tunnel section before removing this if a future cloudflared version
# changes the flag.
cloudflared tunnel --url "http://localhost:${BACKEND_PORT}" --no-autoupdate --protocol http2 > >(tee -a "$LOG_FILE" >> "$RUN_LOG_FILE") 2>&1 &
CF_PID=$!

# The assigned https://<random-words>.trycloudflare.com URL is printed to
# cloudflared's own log output within the first few seconds of startup.
URL=""
for _ in $(seq 1 30); do
  URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$RUN_LOG_FILE" | tail -1 || true)
  [ -n "$URL" ] && break
  sleep 1
done

if [ -n "$URL" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') — assigned URL: $URL" >> "$LOG_FILE"
  /usr/bin/python3 "$REPO_DIR/scripts/update_tunnel_url.py" "$CONSTANTS_FILE" "$URL" >> "$LOG_FILE" 2>&1
else
  echo "$(date '+%Y-%m-%d %H:%M:%S') — WARNING: could not detect tunnel URL after 30s, constants.ts left unchanged" >> "$LOG_FILE"
fi

# Hand off to cloudflared — launchd tracks this script's PID, so it needs to
# stay in the foreground as cloudflared for KeepAlive to notice if the tunnel
# process itself dies.
wait "$CF_PID"
