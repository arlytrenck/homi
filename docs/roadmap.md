# Roadmap

Planned work, in order. The foundations (secret storage, SSRF-guarded fetch, scheduler, DB tables for `integrations` / `widgets`) are already in place.

1. **Plugin / widget SDK** with typed server and client halves and a registry parity test.
2. **Core widgets**: weather, notes, bookmarks, host stats.
3. **Integrations**: Docker, Pi-hole, AdGuard Home, Uptime Kuma, Grafana, Proxmox, TrueNAS, Synology, UniFi, Sonarr/Radarr/Lidarr/Prowlarr, Authentik.
4. **Docker label auto-discovery** (`homi.enable=true`, ...) via a read-only socket or socket-proxy.
5. **Public read-only view hardening** and per-widget public projections.
6. **Service worker** offline cache, Playwright e2e suite, per-integration docs.
