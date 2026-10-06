# Changelog

## Unreleased
- Docker label auto-discovery.
- Brand kit (docs/brand) applied to the app: logo, theme-aware mark, palette, PWA icons.
- Playwright e2e suite (27 tests) in CI, including accessibility checks.
- Fixes: status text contrast, `<main>` landmarks, dragging into empty groups, moving a service forward within a group, success message after changing password, in-page dialogs instead of native prompt/confirm.
- Plugin SDK, core widgets and 14 integrations.
- Fix: PATCH requests no longer reset omitted fields to their defaults.

## 0.1.0
- Initial rewrite on Next.js + TypeScript + SQLite.
- Service launcher, live checks, uptime history, ops view, YAML backup, auth, PWA manifest, multi-arch image pipeline.
