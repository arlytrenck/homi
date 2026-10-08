# Changelog

## Unreleased

- **Alerts**: up to five destinations, each a webhook (Discord, Slack, Home Assistant, any JSON receiver) or ntfy, notified when a service goes down and when it recovers. Configure under Settings → Alerts; the URL is stored encrypted.
- **Service details**: per-service uptime and latency charts (24h to 90d) from the dashboard.
- **Checks**: choose GET or HEAD for HTTP checks.
- **Alert muting**: mute down/recovery alerts per service (works for Docker-managed services too); monitoring continues and a bell-off icon marks the tile. Included in YAML backups.
- **Fixes**: discovery no longer resets check schedules every 30 seconds; SSRF guard now blocks IPv4-mapped IPv6 forms; credentials are not forwarded on cross-origin redirects; the ops view no longer refetches on every status event.

## 0.1.0 (2026-10-05)

First release: a rewrite of Homi on Next.js, TypeScript and SQLite.

- **Dashboard**: service launcher with groups, search, keyboard and mouse drag-and-drop, light/dark theme, installable PWA.
- **Monitoring**: HTTP, TCP and ping checks with live updates, 24h to 90d uptime history, and a dense ops view with kiosk mode.
- **Widgets and integrations**: plugin SDK, built-in weather, notes, bookmarks and host stats, plus Proxmox, Docker, Pi-hole, AdGuard Home, UniFi, Synology, TrueNAS, Sonarr, Radarr, Lidarr, Prowlarr, Authentik, Uptime Kuma and Grafana. Integrations are tested against mock servers, not yet against live instances.
- **Docker auto-discovery**: label containers with `homi.enable=true`.
- **Backup**: YAML export and import with a dry-run preview.
- **Security**: argon2id login, server-side sessions, CSRF origin checks, login rate limiting, SSRF-guarded outbound requests, encrypted integration secrets, public read-only view (off by default).
- **Brand kit** in `docs/brand`, applied to the app.
- **Quality**: 68 unit tests and a 27-test Playwright suite with accessibility checks, run in CI against the production build.
- **Packaging**: multi-arch (amd64/arm64) image on GHCR, built and smoke-tested in CI.
