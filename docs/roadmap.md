# Roadmap

Done: launcher, live checks, uptime history, ops view, YAML backup, plugin SDK, core widgets, 14 integrations.

Next, in order:

1. **Verify integrations against live instances** and fix version differences (see the note in [integrations.md](integrations.md)).
2. **Docker label auto-discovery** (`homi.enable=true`, ...) via a read-only socket or socket-proxy.
3. **Widget drag-and-drop ordering** and per-widget public projections.
4. **Service worker** offline cache, Playwright e2e suite.
5. **Nonce-based CSP** and `frame-ancestors`.
