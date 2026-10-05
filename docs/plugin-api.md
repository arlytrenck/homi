# Plugin API

Plugins are compiled into the image (no runtime code loading). To add one, create `src/plugins/<id>/index.ts`, register it in [`src/plugins/registry.ts`](../src/plugins/registry.ts), add a test, and open a pull request.

Widgets return a small shared shape that one renderer displays, so you only write server-side code.

```ts
import { definePlugin, num, pct } from "../sdk";

export default definePlugin({
  id: "myservice",
  name: "My Service",
  icon: "server",                       // lucide icon name
  description: "What it shows.",
  baseUrlPlaceholder: "http://192.168.1.50:8080",
  config: { username: { kind: "text", label: "Username", required: true } },       // stored in plaintext
  secrets: { apiKey: { kind: "secret", label: "API key", required: true } },       // encrypted at rest

  async test(ctx) {
    try {
      const s = await ctx.json<{ version: string }>("/api/status", { headers: { "x-api-key": ctx.secrets.apiKey } });
      return { ok: true, version: s.version };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },

  widgets: [{
    id: "myservice.summary",            // must start with "<plugin id>."
    title: "My Service",
    minIntervalS: 30,                   // server-side cache; many viewers share one request
    options: { showFoo: { kind: "boolean", label: "Show foo" } },
    async fetch(ctx, options) {
      const d = await ctx.json<any>("/api/summary", { headers: { "x-api-key": ctx.secrets.apiKey } });
      return {
        stats: [{ label: "Items", value: num(d.items) }, { label: "Errors", value: num(d.errors), tone: d.errors ? "warn" : "ok" }],
        meters: [{ label: "Disk", value: d.used / d.total, text: pct((d.used / d.total) * 100) }],
        rows: [{ primary: "Something happened", secondary: "2m ago", tone: "warn" }],
        note: "Optional small text",
      };
    },
  }],
});
```

## Context

`ctx.json(path, init)` and `ctx.raw(path, init)` make requests relative to the integration's base URL through the SSRF guard (timeouts, size caps, TLS option, redirect checks). `json` throws `HttpError` on non-2xx; `raw` returns the status. `ctx.cache` is a small TTL store for things like session ids. **Never use the global `fetch`** in plugins; an ESLint rule rejects it.

## Output

`stats` (big numbers), `meters` (0..1 bars), `rows` (list items, optional `href`), and `note`. Tones: `ok`, `warn`, `down`, `neutral`. Status is always shown with text as well as colour.

## Field kinds

`text`, `textarea`, `url`, `number`, `secret`, `boolean`, `select`. The settings forms are generated from these.

## Testing

Add a case to [`src/plugins/integrations.test.ts`](../src/plugins/integrations.test.ts): add routes to the mock server and assert on your widget's output. The registry test checks id uniqueness and namespacing.
