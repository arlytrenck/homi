# Changelog

## 0.3.0 (2026-10-26)

- **Widgets**: drag to reorder widgets in edit mode (mouse, touch or keyboard).
- **Public detail**: each widget has a Public detail setting. Summary (the default for new widgets) shows signed-out viewers only numbers and meters; rows, links and notes are removed on the server. Full keeps the old behavior, and existing widgets stay on Full.

## 0.2.0 (2026-10-24)

- **Setup**: first-run setup now asks for a one-time code printed in the server log (`docker logs homi`), so nobody can claim the admin account on a freshly exposed instance. `HOMI_SETUP_TOKEN` still lets you choose your own; `HOMI_SETUP_OPEN=1` turns the requirement off.
- **Security**: TCP, TLS and ping checks now refuse blocked IP-literal targets (loopback unless allowed, link-local and cloud-metadata addresses). Login lockouts are scoped to the client IP and IP+username, so a stranger can no longer lock the admin out. Responses carry `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff` and a `Referrer-Policy`. Public viewers no longer receive live status events for services hidden from the public view.
- **Backups**: service dependencies are exported and imported by upstream name (`dependsOn`); unknown or looping upstreams are skipped and reported.
- **Fixes**: saving a layout with a deleted group or service returns a clear 400 instead of a 500; the Radarr widget shows the earliest upcoming release; one malformed bookmark line no longer breaks the Bookmarks widget.

- **Alerts**: up to five destinations, each a webhook (Discord, Slack, Home Assistant, any JSON receiver) or ntfy, notified when a service goes down and when it recovers. Configure under Settings → Alerts; the URL is stored encrypted.
- **Service details**: per-service uptime and latency charts (24h to 90d) from the dashboard.
- **Checks**: choose GET or HEAD for HTTP checks. New **TLS certificate expiry** check (degraded within 14 days, down once expired; self-signed is fine) and **heartbeat** check for cron and backup jobs (`/api/heartbeat/<token>`, plus `/fail`); TCP checks now go through the same SSRF guard as HTTP.
- **Alert routing**: limit each destination to selected groups, ungrouped services, or tags (a match on any selector routes the alert); a destination with none selected gets everything. Services now have editable tags (also via the `homi.tags` Docker label). Deleting a group removes it from routing.
- **Quiet hours**: per-destination daily window (time zone aware, may cross midnight) during which alerts are held (except for services carrying a configured override tag such as `critical`, which always alert), with an optional single summary of services still down when it ends. Held alerts are dropped, not queued; a restart inside the window widens the summary to the last 12 hours.
- **Maintenance windows**: hold alerts for everything, a group or one service for a set time (Settings → Maintenance, or the service detail dialog). Checks keep running; tiles show a Maintenance badge; one "still down" alert is sent when a window ends. Windows can repeat weekly (chosen days, start time, duration up to 48 h, time zone aware).
- **Dependencies**: a service can depend on another; when the upstream is down its dependents show "Affected by …" and stay quiet (one alert for the root cause, plus a follow-up if a dependent is still down after the upstream recovers).
- **Incident log**: every outage is recorded (start, duration, cause or upstream) under Ops → Incidents and in each service's detail dialog, kept for 90 days.
- **Command palette**: Cmd/Ctrl+K to jump to a service or page, toggle the theme, or sign out.
- **Public status page** at `/status` (Settings → General): no sign-in, 90-day uptime bars, recent incidents without error details; services marked hidden never appear.
- **Backups**: YAML export and import now also cover weekly maintenance schedules and alert destinations (routing, quiet hours). Destination URLs are secrets and are never exported, so imported destinations stay switched off until you enter the URL. Items naming a group or service that does not exist are skipped and reported. Replace mode only replaces the sections the file contains.
- **Alert muting**: mute down/recovery alerts per service (works for Docker-managed services too); monitoring continues and a bell-off icon marks the tile. Included in YAML backups.
- **Fixes**: deleting a service no longer risks a crash when its buffered check results are written; discovery no longer resets check schedules every 30 seconds; SSRF guard now blocks IPv4-mapped IPv6 forms; credentials are not forwarded on cross-origin redirects; the ops view no longer refetches on every status event.

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
