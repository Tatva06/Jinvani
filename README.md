# Jinvani · The Jain Micro-Reader

> A trilingual (EN / HI / GU) Inshorts-style app for reading 60-word classical Jain scripture summaries.

## Monorepo Structure

```
jinvani-core/
├── mobile/     # Expo (React Native) — vertical swipe feed
└── backend/    # FastAPI (Python) + Supabase PostgreSQL
```

## Quick Start

### Mobile
```bash
cd mobile
npm install
expo start --ios
```

### Backend
```bash
cd backend
cp .env.example .env   # fill in SUPABASE_URL + SUPABASE_KEY
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs available at `http://localhost:8000/docs`

## Cloudflare Tunnel (backend exposure for the mobile app)

The mobile app talks to the backend over a Cloudflare Tunnel (`mobile/src/constants.ts`'s `API_BASE_URL`), not `localhost`, so it works from a physical device/simulator on the same network without extra config.

**Why not a permanent named tunnel:** a stable `https://something.yourdomain.com` hostname requires a domain already added to a Cloudflare account (tunnels route via DNS CNAME — `cloudflared tunnel route dns`). This project doesn't have one, so we're on Cloudflare's free "quick tunnel" (`cloudflared tunnel --url ...`), which mints a random `*.trycloudflare.com` URL on every start. If a domain is ever added to a Cloudflare account, switch to a named tunnel and this whole section becomes unnecessary.

**What's set up instead:** since the URL can't be made permanent without a domain, the actual fix is to stop needing a human to babysit it:

- `scripts/cloudflared-tunnel.sh` starts the quick tunnel, waits for cloudflared to print its assigned URL, and calls `scripts/update_tunnel_url.py` to rewrite the active `API_BASE_URL` line in `mobile/src/constants.ts` automatically (keeping the previous URL as a one-line comment above it, not an ever-growing pile).
- `~/Library/LaunchAgents/com.jinvani.cloudflared-tunnel.plist` is a macOS launchd service (`KeepAlive: true`, `RunAtLoad: true`) that runs that script. It starts on login/reboot and is restarted immediately by launchd if cloudflared ever dies or is killed — no more manually re-running a cloudflared command in a terminal you have to remember to leave open.

**Day to day:** you shouldn't need to do anything — the tunnel is always running, and `constants.ts` always reflects whatever URL it currently has. If the app can't reach the backend, check:

```bash
# Is the service running?
launchctl print gui/$(id -u)/com.jinvani.cloudflared-tunnel | grep state

# What URL is it currently using, and is the backend itself up on :8000?
grep '^export const API_BASE_URL' mobile/src/constants.ts
lsof -i :8000

# Tunnel's own logs (startup, assigned URL, any errors)
tail -n 50 ~/Library/Logs/jinvani-cloudflared/cloudflared.log

# Force a restart (e.g. to pick up a backend restart, or just to get a fresh URL)
launchctl kickstart -k gui/$(id -u)/com.jinvani.cloudflared-tunnel

# Fully stop it (rarely needed)
launchctl bootout gui/$(id -u)/com.jinvani.cloudflared-tunnel

# Re-enable it after a bootout
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.jinvani.cloudflared-tunnel.plist
```

After any restart the URL changes — give the Expo app a reload (it reads `constants.ts` at bundle time) rather than assuming a stale error means the backend is down.

**Known quirk — brand-new URL not resolving for a few minutes:** on at least one dev machine/network, a freshly-minted `*.trycloudflare.com` hostname sometimes fails to resolve via the network's default DNS resolver for several minutes after creation, even though the tunnel itself is already live (confirmed instantly reachable via `1.1.1.1`/`8.8.8.8` the whole time). If the app can't reach the backend right after a restart:

```bash
# Confirm it's actually a DNS delay, not a dead tunnel:
dig @1.1.1.1 +short "$(grep '^export const API_BASE_URL' mobile/src/constants.ts | sed -E "s/.*'(.*)'.*/\1/" | sed -E 's#https://##')"
```
If that resolves but a plain `curl`/the app doesn't, it's this quirk — wait a few minutes, or (more permanently) add `1.1.1.1` as a DNS server on this Mac's active network interface.
