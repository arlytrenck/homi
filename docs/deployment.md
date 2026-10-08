# Deployment

Homi runs as a single container with one SQLite file. Run **one replica only**: the check scheduler is in-process.

## Compose

Start from the repo's [docker-compose.yml](../docker-compose.yml). Persist `/data`; it holds the database and the generated encryption key. Pin the key yourself if you prefer:

```bash
openssl rand -base64 32   # set as HOMI_SECRET_KEY, or mount a file and set HOMI_SECRET_KEY_FILE
```

## Reverse proxy

Behind Caddy, nginx, Traefik, etc., set:

```yaml
HOMI_PUBLIC_URL: https://homi.example.com   # CSRF origin check
HOMI_TRUST_PROXY: "1"                       # honor X-Forwarded-For/Proto (only behind your own proxy)
```

Forward the `Host` header and allow long-lived responses for `/api/events` (server-sent events); disable proxy buffering for that path. Example Caddy:

```
homi.example.com {
  reverse_proxy homi:3000
}
```

If you expose Homi publicly, set `HOMI_SETUP_TOKEN` before first start and consider leaving the public view off.

## Upgrading

```bash
docker compose pull && docker compose up -d
```

Database migrations run automatically at startup. Back up `./data` first; there is no downgrade path for migrations.

## Health and logs

The container logs `[homi] ready` once the scheduler is running. `docker logs homi` shows check, discovery and alert errors.

## Resource notes

- Ping checks need `cap_add: NET_RAW`.
- Docker auto-discovery needs the socket (or a socket proxy); see [docker-labels.md](docker-labels.md) and [security.md](security.md).
- Host stats widget shows the container's view unless host paths are mounted.
