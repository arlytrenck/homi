import { definePlugin, pct, type Tone } from "../sdk";

const TONE: Record<number, Tone> = { 1: "ok", 0: "down", 2: "warn", 3: "warn" };

export default definePlugin({
  id: "uptimekuma", name: "Uptime Kuma", icon: "activity", description: "Monitors from a public status page (no credentials).",
  baseUrlPlaceholder: "http://192.168.1.3:3001",
  config: { slug: { kind: "text", label: "Status page slug", required: true, placeholder: "default" } },
  secrets: {},
  async test(ctx) {
    try { const p = await ctx.json<any>(`/api/status-page/${encodeURIComponent(ctx.config.slug)}`); return { ok: true, version: p.config?.title }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  },
  widgets: [{
    id: "uptimekuma.status", title: "Uptime Kuma",
    async fetch(ctx) {
      const slug = encodeURIComponent(ctx.config.slug);
      const [page, hb] = await Promise.all([ctx.json<any>(`/api/status-page/${slug}`), ctx.json<any>(`/api/status-page/heartbeat/${slug}`)]);
      const monitors = (page.publicGroupList ?? []).flatMap((g: any) => g.monitorList ?? []);
      const rows = monitors.map((m: any) => {
        const beats = hb.heartbeatList?.[String(m.id)] ?? [];
        const last = beats[beats.length - 1];
        const up24 = hb.uptimeList?.[`${m.id}_24`];
        return { primary: m.name as string, secondary: up24 != null ? pct(up24 * 100, 2) : undefined, tone: (last ? TONE[last.status] ?? "neutral" : "neutral") as Tone };
      });
      const down = rows.filter((r: any) => r.tone === "down").length;
      return { stats: [{ label: "Monitors", value: String(rows.length) }, { label: "Down", value: String(down), tone: down ? "down" : "ok" }], rows: rows.sort((a: any, b: any) => (a.tone === "down" ? -1 : 0) - (b.tone === "down" ? -1 : 0)).slice(0, 8) };
    },
  }],
});
