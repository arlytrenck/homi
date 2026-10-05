import { definePlugin, num } from "../sdk";

const hdr = (s: Record<string, string>) => ({ authorization: `Bearer ${s.token}` });

export default definePlugin({
  id: "authentik", name: "Authentik", icon: "lock", description: "Users, failed logins and version.",
  baseUrlPlaceholder: "https://auth.example.com",
  secrets: { token: { kind: "secret", label: "API token", required: true } },
  async test(ctx) { try { const v = await ctx.json<any>("/api/v3/admin/version/", { headers: hdr(ctx.secrets) }); return { ok: true, version: v.version_current }; } catch (e) { return { ok: false, error: (e as Error).message }; } },
  widgets: [{
    id: "authentik.summary", title: "Authentik",
    async fetch(ctx) {
      const h = hdr(ctx.secrets);
      const since = new Date(Date.now() - 864e5).toISOString();
      const [users, failed, ver] = await Promise.all([
        ctx.json<any>("/api/v3/core/users/?page_size=1", { headers: h }),
        ctx.json<any>(`/api/v3/events/events/?action=login_failed&page_size=1&created__gte=${encodeURIComponent(since)}`, { headers: h }),
        ctx.json<any>("/api/v3/admin/version/", { headers: h }),
      ]);
      const f = failed.pagination?.count ?? 0;
      return {
        stats: [{ label: "Users", value: num(users.pagination?.count) }, { label: "Failed logins (24h)", value: num(f), tone: f > 10 ? "warn" : "ok" }],
        note: `v${ver.version_current}${ver.outdated ? " (update available)" : ""}`,
      };
    },
  }],
});
