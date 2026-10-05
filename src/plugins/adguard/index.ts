import { basic, definePlugin, num, pct } from "../sdk";

export default definePlugin({
  id: "adguard", name: "AdGuard Home", icon: "shield", description: "DNS filtering stats.",
  baseUrlPlaceholder: "http://192.168.1.2:3000",
  config: { username: { kind: "text", label: "Username", required: true } },
  secrets: { password: { kind: "secret", label: "Password", required: true } },
  async test(ctx) {
    try { const s = await ctx.json<any>("/control/status", { headers: { authorization: basic(ctx.config.username, ctx.secrets.password) } }); return { ok: true, version: s.version }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  },
  widgets: [{
    id: "adguard.summary", title: "AdGuard Home",
    async fetch(ctx) {
      const h = { authorization: basic(ctx.config.username, ctx.secrets.password) };
      const [s, st] = await Promise.all([ctx.json<any>("/control/stats", { headers: h }), ctx.json<any>("/control/status", { headers: h })]);
      const total = s.num_dns_queries ?? 0, blocked = s.num_blocked_filtering ?? 0;
      return {
        stats: [{ label: "Queries", value: num(total) }, { label: "Blocked", value: pct(total ? (blocked / total) * 100 : 0, 1), hint: num(blocked) }, { label: "Avg time", value: `${((s.avg_processing_time ?? 0) * 1000).toFixed(0)} ms` }],
        note: st.protection_enabled ? "Protection enabled" : "Protection DISABLED",
      };
    },
  }],
});
