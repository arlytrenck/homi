# Architecture

One Next.js (App Router) app, built to a standalone server, with SQLite via Drizzle. No external services.

## Layout

| Path | Role |
|---|---|
| `src/app/(auth)` | `/login`, `/setup` |
| `src/app/(dash)` | Dashboard, `/ops`, settings |
| `src/app/api/*` | JSON routes: auth, services, groups, checks, events (SSE), notifications, integrations, widgets, config (YAML), discovery, health |
| `src/components`, `src/lib` | UI, shared zod schemas (`lib/schemas.ts`), client helpers |
| `src/server/auth` | argon2id, sessions, login rate limit, request guard (CSRF origin check) |
| `src/server/db` | Drizzle schema and client; migrations in `drizzle/` run on startup |
| `src/server/scheduler` | In-process check scheduler: runs checks, applies the down-after-2-failures rule, writes results, hourly rollups, pruning |
| `src/server/checks` | HTTP / TCP / ping runners |
| `src/server/events` | In-memory hub that fans status changes out to SSE clients |
| `src/server/notify` | Alert destinations, sealed URLs, webhook/ntfy delivery |
| `src/server/discovery` | Docker label sync into managed services |
| `src/server/integrations`, `src/plugins/*` | Plugin runtime and the built-in integrations (see [plugin-api.md](plugin-api.md)) |
| `src/server/net/safeFetch.ts` | The only allowed outbound HTTP path (SSRF guard) |
| `src/server/crypto` | AES-256-GCM secret box, HKDF-derived key |
| `src/server/config/yaml.ts` | Backup export/import |

## Data model

Tables (`src/server/db/schema.ts`): `users`, `sessions`, `settings` (key/value JSON, including alert destinations), `groups`, `services`, `checks`, `check_results` (raw), `check_rollups` (hourly), `integrations`, `widgets`, `notes`, `bookmarks`, `audit_log`.

## Runtime flow

1. `boot()` (once per process) loads the master key, opens the DB and runs migrations, starts the scheduler and Docker discovery, and registers graceful shutdown.
2. The scheduler runs each enabled check on its interval. A status change updates the check row, publishes an event to the hub, and triggers alert delivery for `down` and `recovered` transitions unless the service is muted.
3. The browser loads data over the API and subscribes to `/api/events`; React Query caches and is invalidated by events.
4. All outbound requests (checks, integrations, alerts) go through `safeFetch`; an ESLint rule forbids raw `fetch` in server code.

## Constraints

Single replica (in-process scheduler, SQLite). Secrets are only readable server-side; the API never returns them.

## Testing

`pnpm test` (Vitest unit tests next to the code), `pnpm e2e` (Playwright against the production build, including axe accessibility checks), `pnpm verify:integrations` (integration contract checks).
