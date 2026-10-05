import { bytes, clamp01, definePlugin, pct, type IntegrationContext } from "../sdk";

async function sid(ctx: IntegrationContext): Promise<string> {
  const cached = ctx.cache.get<string>("sid");
  if (cached) return cached;
  const r = await ctx.json<any>("/webapi/auth.cgi", { method: "POST", form: { api: "SYNO.API.Auth", version: "6", method: "login", account: ctx.config.username, passwd: ctx.secrets.password, session: "Homi", format: "sid" } });
  if (!r.success) throw new Error(`DSM login failed (code ${r.error?.code ?? "?"}; 2-factor accounts are not supported)`);
  ctx.cache.set("sid", r.data.sid as string, 10 * 60_000);
  return r.data.sid;
}
const entry = (ctx: IntegrationContext, s: string, api: string, method: string, version = 1) => ctx.json<any>("/webapi/entry.cgi", { method: "POST", form: { api, version: String(version), method, _sid: s } });

export default definePlugin({
  id: "synology", name: "Synology DSM", icon: "hard-drive", description: "CPU, memory and volume usage. Use a dedicated non-2FA user with read access.",
  baseUrlPlaceholder: "https://192.168.1.30:5001",
  config: { username: { kind: "text", label: "Username", required: true } },
  secrets: { password: { kind: "secret", label: "Password", required: true } },
  async test(ctx) { try { await sid(ctx); return { ok: true }; } catch (e) { return { ok: false, error: (e as Error).message }; } },
  widgets: [{
    id: "synology.system", title: "Synology",
    async fetch(ctx) {
      const s = await sid(ctx);
      const [util, storage] = await Promise.all([entry(ctx, s, "SYNO.Core.System.Utilization", "get"), entry(ctx, s, "SYNO.Storage.CGI.Storage", "load_info")]);
      if (!util.success) { ctx.cache.set("sid", "", 0); throw new Error("DSM session expired"); }
      const cpu = (util.data?.cpu?.user_load ?? 0) + (util.data?.cpu?.system_load ?? 0);
      const mem = util.data?.memory?.real_usage ?? 0;
      const vols: any[] = storage.data?.volumes ?? [];
      return {
        meters: [{ label: "CPU", value: clamp01(cpu / 100), text: pct(cpu) }, { label: "Memory", value: clamp01(mem / 100), text: pct(mem) },
          ...vols.map((v) => { const t = Number(v.size?.total ?? 0), u = Number(v.size?.used ?? 0); return { label: `${v.id ?? v.vol_path} (${v.status})`, value: clamp01(u / (t || 1)), text: `${bytes(u)} / ${bytes(t)}` }; })],
        stats: [{ label: "Volumes healthy", value: `${vols.filter((v) => v.status === "normal").length} / ${vols.length}`, tone: vols.some((v) => v.status !== "normal") ? "warn" : "ok" }],
      };
    },
  }],
});
