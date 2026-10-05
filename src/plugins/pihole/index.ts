import { definePlugin, num, pct, type IntegrationContext } from "../sdk";

/** Pi-hole v6 uses a session (POST /api/auth); v5 uses ?auth=<token>. The secret is the app password (v6) or API token (v5). */
async function summary(ctx: IntegrationContext) {
  const pw = ctx.secrets.password ?? "";
  let sid = ctx.cache.get<string>("sid");
  if (!sid) {
    const r = await ctx.raw("/api/auth", { method: "POST", body: { password: pw } });
    if (r.status === 200 && r.json().session?.valid) { sid = r.json().session.sid as string; ctx.cache.set("sid", sid, 4 * 60_000); }
    else if (r.status === 404 || r.status === 405) {
      const v5 = await ctx.json<any>(`/admin/api.php?summaryRaw&auth=${encodeURIComponent(pw)}`);
      if (!("dns_queries_today" in v5)) throw new Error("Invalid Pi-hole API token");
      return { total: v5.dns_queries_today, blocked: v5.ads_blocked_today, percent: v5.ads_percentage_today, clients: v5.unique_clients, domains: v5.domains_being_blocked, version: "v5" };
    } else throw new Error(r.status === 401 ? "Invalid Pi-hole password" : `Pi-hole auth failed (${r.status})`);
  }
  const s = await ctx.json<any>("/api/stats/summary", { headers: { sid } });
  return { total: s.queries.total, blocked: s.queries.blocked, percent: s.queries.percent_blocked, clients: s.clients.active, domains: s.gravity.domains_being_blocked, version: "v6" };
}

export default definePlugin({
  id: "pihole", name: "Pi-hole", icon: "shield-check", description: "DNS ad-blocking stats (v5 and v6).",
  baseUrlPlaceholder: "http://192.168.1.2",
  secrets: { password: { kind: "secret", label: "App password (v6) or API token (v5)", required: true } },
  async test(ctx) { try { const s = await summary(ctx); return { ok: true, version: s.version }; } catch (e) { return { ok: false, error: (e as Error).message }; } },
  widgets: [{
    id: "pihole.summary", title: "Pi-hole",
    async fetch(ctx) {
      const s = await summary(ctx);
      return { stats: [{ label: "Queries", value: num(s.total) }, { label: "Blocked", value: pct(s.percent, 1), hint: num(s.blocked) }, { label: "Clients", value: num(s.clients) }], note: `${num(s.domains)} domains on blocklists` };
    },
  }],
});
