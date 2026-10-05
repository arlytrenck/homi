import { definePlugin, num } from "../sdk";

const hdr = (s: Record<string, string>): Record<string, string> => (s.token ? { authorization: `Bearer ${s.token}` } : {});

export default definePlugin({
  id: "grafana", name: "Grafana", icon: "chart-line", description: "Health and dashboard count. Token (service account, Viewer) is optional for health only.",
  baseUrlPlaceholder: "http://192.168.1.5:3000",
  secrets: { token: { kind: "secret", label: "Service account token" } },
  async test(ctx) { try { const h = await ctx.json<any>("/api/health"); return { ok: true, version: h.version }; } catch (e) { return { ok: false, error: (e as Error).message }; } },
  widgets: [{
    id: "grafana.status", title: "Grafana",
    async fetch(ctx) {
      const health = await ctx.json<any>("/api/health");
      let dashboards: number | undefined;
      if (ctx.secrets.token) dashboards = (await ctx.json<any[]>("/api/search?type=dash-db&limit=5000", { headers: hdr(ctx.secrets) })).length;
      return { stats: [{ label: "Database", value: String(health.database ?? "?"), tone: health.database === "ok" ? "ok" : "down" }, ...(dashboards != null ? [{ label: "Dashboards", value: num(dashboards) }] : [])], note: health.version ? `v${health.version}` : undefined };
    },
  }],
});
