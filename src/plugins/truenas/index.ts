import { bytes, clamp01, definePlugin, duration, type Tone } from "../sdk";

const hdr = (s: Record<string, string>) => ({ authorization: `Bearer ${s.apiKey}` });
const LEVEL: Record<string, Tone> = { CRITICAL: "down", ERROR: "down", ALERT: "down", EMERGENCY: "down", WARNING: "warn", NOTICE: "neutral", INFO: "neutral" };

export default definePlugin({
  id: "truenas", name: "TrueNAS", icon: "database", description: "Pool health, capacity and alerts.",
  baseUrlPlaceholder: "https://192.168.1.20",
  secrets: { apiKey: { kind: "secret", label: "API key (Credentials > API Keys)", required: true } },
  async test(ctx) { try { const i = await ctx.json<any>("/api/v2.0/system/info", { headers: hdr(ctx.secrets) }); return { ok: true, version: i.version }; } catch (e) { return { ok: false, error: (e as Error).message }; } },
  widgets: [{
    id: "truenas.pools", title: "TrueNAS",
    async fetch(ctx) {
      const h = hdr(ctx.secrets);
      const [info, pools, alerts] = await Promise.all([ctx.json<any>("/api/v2.0/system/info", { headers: h }), ctx.json<any[]>("/api/v2.0/pool", { headers: h }), ctx.json<any[]>("/api/v2.0/alert/list", { headers: h })]);
      const active = alerts.filter((a) => !a.dismissed && (LEVEL[a.level] ?? "neutral") !== "neutral");
      const worst = active.some((a) => LEVEL[a.level] === "down") ? "down" : active.length ? "warn" : "ok";
      return {
        meters: pools.map((p) => ({ label: `${p.name} (${p.status})`, value: clamp01((p.allocated ?? 0) / (p.size || 1)), text: `${bytes(p.allocated)} / ${bytes(p.size)}` })),
        stats: [{ label: "Alerts", value: String(active.length), tone: worst as Tone }, { label: "Uptime", value: duration(info.uptime_seconds) }],
        rows: active.slice(0, 3).map((a) => ({ primary: String(a.formatted ?? a.klass).slice(0, 90), tone: LEVEL[a.level] })),
      };
    },
  }],
});
