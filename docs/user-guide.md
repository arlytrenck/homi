# User guide

## First run

Open Homi and create the admin account at `/setup`. Only one account exists; setup is closed once it is created. If Homi is reachable beyond your LAN before you finish, set `HOMI_SETUP_TOKEN` and enter it on the setup page.

## Services and groups

- **Add a service**: Edit mode → add service. A service has a name, URL, optional icon and description, tags, and an optional health check.
- **Groups** collect services on the dashboard and can be collapsed. Drag to reorder (mouse, touch or keyboard).
- **Search**: press `/` to filter by name, description or tag.
- **Hidden from public**: services marked this way never appear in the public read-only view (off by default).
- **Docker-managed** services come from container labels and are edited in Docker, not in Homi. See [docker-labels.md](docker-labels.md).

## Health checks

| Type | Passes when |
|---|---|
| HTTP | Response status matches the expected status (optionally containing a keyword). GET or HEAD. |
| TCP | A connection to host:port opens. |
| Ping | ICMP echo answers. Needs `NET_RAW`; otherwise falls back to TCP 443/80. |

- Interval is 10 s to 24 h (default 60 s); timeout is 0.5 s to 30 s (default 5 s).
- **Up / degraded / down**: a check is *degraded* when it succeeds but takes longer than 80% of its timeout, or an HTTP keyword is missing. A service goes *down* only after two consecutive failures, so a single blip does not flip it.
- **Ignore TLS errors** allows self-signed certificates.
- Checks against `127.0.0.0/8` are blocked unless you enable loopback (Settings, or `HOMI_ALLOW_LOOPBACK=1`).
- Click a tile's status to open its **uptime detail**: latency and uptime charts for 24h, 7d, 30d and 90d.

History: raw results are kept 48 hours (configurable), then rolled up hourly and kept 90 days.

## Ops view

`/ops` is a dense, worst-first table for a wall display. `/ops?kiosk=1` hides navigation chrome.

## Alerts

Settings → Alerts. Add up to five destinations:

- **Webhook**: Discord, Slack, Mattermost, Home Assistant, or any receiver. Homi POSTs JSON with `text`, `content`, `event` (`down` or `recovered`), `service`, `status`, `previous`, `target`, `error`, `downForMs` and `ts`.
- **ntfy**: POSTs plain text to the topic URL, with title, tag and priority headers.

Each destination can be disabled and can opt out of recovery messages. Use **Send test** to verify delivery; the last result is shown per destination. URLs are stored encrypted because they usually embed a token. Mute a single service from its tile (bell-off icon); it is still monitored.

## Integrations and widgets

See [integrations.md](integrations.md). Built-in widgets (weather, notes, bookmarks, host stats) need no integration. Custom integrations: [plugin-api.md](plugin-api.md).

## Backup and restore

Settings → Backup exports services, groups, checks and mute flags as YAML. Import offers **merge** (match by name within a group) or **replace**, with a **dry run** that previews counts first. Exports never contain secrets, and Docker-managed services are excluded.

To back up everything including integrations and secrets, copy the whole data directory (`./data`): the SQLite file **and** the encryption key. A database without its key cannot decrypt stored secrets.

## Account recovery

```bash
docker exec -it homi node dist/scripts/reset-password.js <username>
```
