# Homi

A self-hostable homelab dashboard: a fast launcher for your services, with live health checks and uptime history. One container, one SQLite file, no external database.

## Features (v0.1)

- **Service launcher**: groups, icons, descriptions, search (`/`), drag-and-drop ordering (touch and keyboard friendly), light/dark theme.
- **Live status**: HTTP, TCP and ping checks with up / degraded / down states, SSE live updates, 24h/7d/30d/90d uptime history with hourly rollups.
- **Ops view** (`/ops`): dense NOC-style table, worst-first, with a kiosk mode (`/ops?kiosk=1`).
- **Backup**: YAML export/import with dry-run preview.
- **Security by default**: argon2id password, hashed server-side sessions, CSRF origin checks, login rate limiting, SSRF-guarded outbound requests, AES-256-GCM encryption for stored secrets.
- **Installable PWA manifest**, multi-arch (amd64/arm64) image pipeline.

See [docs/roadmap.md](docs/roadmap.md) for what is next (integrations, widgets, Docker auto-discovery).

## Quick start

```bash
mkdir homi && cd homi
curl -O https://raw.githubusercontent.com/arlytrenck/homi/main/docker-compose.yml
docker compose up -d
```

Open <http://localhost:3000> and create the admin account. Data lives in `./data` (the SQLite database and the generated encryption key). **Back up the whole folder.**

## Configuration

| Variable | Purpose |
|---|---|
| `HOMI_DATA` | Data directory (default `/data` in the image) |
| `HOMI_SECRET_KEY` / `HOMI_SECRET_KEY_FILE` | 32-byte base64 key for secrets at rest. Generated into the data directory if unset |
| `HOMI_SETUP_TOKEN` | Require this token on first-run setup (use when exposed beyond your LAN) |
| `HOMI_PUBLIC_URL` | External URL; used for the CSRF origin check behind a proxy |
| `HOMI_TRUST_PROXY=1` | Trust `X-Forwarded-For/Proto` (set only behind your own reverse proxy) |
| `HOMI_ALLOW_LOOPBACK=1` | Allow checks against `127.0.0.0/8` (also a UI setting) |
| `PORT`, `HOSTNAME`, `TZ`, `PUID`, `PGID` | Standard |

Ping checks need the `NET_RAW` capability (included in the compose file); without it they fall back to TCP 443/80.

Forgot your password: `docker exec -it homi node dist/scripts/reset-password.js <username>`.

## Development

```bash
corepack enable && pnpm install
pnpm dev          # http://localhost:3000, data in ./data
pnpm lint && pnpm typecheck && pnpm test
pnpm build        # produces a self-contained .next/standalone
```

Requires Node 22+.

## Security notes

Homi must reach private addresses, so its outbound guard (`src/server/net/safeFetch.ts`) allows RFC1918 ranges but always blocks link-local/cloud-metadata addresses, validates the *connected* IP (defeating DNS rebinding), re-validates every redirect, and blocks loopback unless you enable it. Details in [docs/security.md](docs/security.md).

## License

MIT
