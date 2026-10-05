# Integrations

Add an integration under **Settings → Integrations**, press **Test connection**, then add its widgets from the dashboard (**Edit → Add widget**). Secrets are encrypted at rest and are never returned by the API; leave a secret field blank when editing to keep the saved value.

> **Verification status.** Every integration is covered by automated tests against mock servers written from each product's public API documentation. They have **not** yet been verified against live instances, and vendors change APIs between versions. If a widget misbehaves, the error is shown on the card and in the integration list; please open an issue with the product version.

Use a dedicated, least-privilege account or token for each one. Enable **Ignore TLS errors** for self-signed certificates.

| Integration | Credentials | Widgets |
|---|---|---|
| Proxmox VE | API token with `PVEAuditor` role: token ID (`user@realm!name`) and secret | CPU/memory, guests running, nodes online |
| Docker | None. `unix:///var/run/docker.sock` (mount the socket) or a `http://socket-proxy:2375` URL | Running count, unhealthy/stopped containers |
| Pi-hole | v6: app password. v5: API token | Queries, blocked %, clients |
| AdGuard Home | Username and password | Queries, blocked %, avg. time, protection state |
| UniFi Network | API key (Network → Integrations) | Devices online, clients, offline devices |
| Synology DSM | Non-2FA user, read access | CPU, memory, volumes |
| TrueNAS | API key | Pool usage, alerts, uptime |
| Sonarr / Radarr / Lidarr / Prowlarr | API key (Settings → General) | Queue, missing, health, next episode/movie |
| Authentik | API token | Users, failed logins (24h), version |
| Uptime Kuma | None. Needs a public status page; enter its slug | Monitor states and 24h uptime |
| Grafana | Optional service-account token (Viewer) | Health, dashboard count |

## Docker access

Mounting `/var/run/docker.sock` gives the container the ability to control Docker, even with `:ro`. Homi only calls read-only list endpoints, but a [docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy) with `CONTAINERS=1` and `VERSION=1` is the safer setup: use its `http://` URL as the base URL instead.

## Built-in widgets

Weather (Open-Meteo, no key), notes, bookmarks, and host stats. Host stats show the container's view unless you mount host paths.

## Outbound policy

All requests go through the SSRF guard: private (RFC1918) addresses are allowed, cloud-metadata/link-local addresses are always blocked, and loopback is blocked unless enabled in Settings. See [security.md](security.md).
