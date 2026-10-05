import { definePlugin, num } from "../sdk";

const hdr = (s: Record<string, string>) => ({ "x-api-key": s.apiKey });
const base = "/proxy/network/integration/v1";

export default definePlugin({
  id: "unifi", name: "UniFi Network", icon: "network", description: "Device and client counts via the UniFi Network integration API (API key).",
  baseUrlPlaceholder: "https://192.168.1.1",
  secrets: { apiKey: { kind: "secret", label: "API key (Network > Integrations)", required: true } },
  async test(ctx) {
    try { const s = await ctx.json<any>(`${base}/info`, { headers: hdr(ctx.secrets) }); return { ok: true, version: s.applicationVersion }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  },
  widgets: [{
    id: "unifi.network", title: "UniFi",
    async fetch(ctx) {
      const h = hdr(ctx.secrets);
      const sites = await ctx.json<any>(`${base}/sites?limit=1`, { headers: h });
      const site = sites.data?.[0];
      if (!site) throw new Error("No UniFi site found");
      const [devices, clients] = await Promise.all([ctx.json<any>(`${base}/sites/${site.id}/devices?limit=200`, { headers: h }), ctx.json<any>(`${base}/sites/${site.id}/clients?limit=1`, { headers: h })]);
      const d: any[] = devices.data ?? [];
      const offline = d.filter((x) => x.state !== "ONLINE");
      return {
        stats: [{ label: "Devices online", value: `${d.length - offline.length} / ${d.length}`, tone: offline.length ? "warn" : "ok" }, { label: "Clients", value: num(clients.totalCount ?? clients.count) }],
        rows: offline.slice(0, 4).map((x) => ({ primary: x.name ?? x.macAddress, secondary: String(x.state).toLowerCase(), tone: "down" as const })),
        note: site.name,
      };
    },
  }],
});
