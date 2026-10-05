import { definePlugin, num, type IntegrationPlugin, type IntegrationContext } from "../sdk";

const get = <T = any>(ctx: IntegrationContext, v: string, p: string) => ctx.json<T>(`/api/${v}${p}`, { headers: { "x-api-key": ctx.secrets.apiKey } });

function arr(id: string, name: string, icon: string, v: "v3" | "v1", wantedLabel: string, calendar?: (ctx: IntegrationContext) => Promise<string | undefined>): IntegrationPlugin {
  return definePlugin({
    id, name, icon, description: `${name} queue, backlog and health.`, baseUrlPlaceholder: "http://192.168.1.4:8989",
    secrets: { apiKey: { kind: "secret", label: "API key (Settings > General)", required: true } },
    async test(ctx) { try { const s = await get(ctx, v, "/system/status"); return { ok: true, version: s.version }; } catch (e) { return { ok: false, error: (e as Error).message }; } },
    widgets: [{
      id: `${id}.summary`, title: name,
      async fetch(ctx) {
        const [queue, health, wanted, next] = await Promise.all([
          get(ctx, v, "/queue?pageSize=1"), get<any[]>(ctx, v, "/health"),
          wantedLabel ? get(ctx, v, "/wanted/missing?pageSize=1") : Promise.resolve(null),
          calendar ? calendar(ctx).catch(() => undefined) : Promise.resolve(undefined),
        ]);
        const issues = health.filter((h) => h.type === "error" || h.type === "warning");
        const hasError = issues.some((h) => h.type === "error");
        return {
          stats: [
            { label: "Queue", value: num(queue.totalRecords) },
            ...(wanted ? [{ label: wantedLabel, value: num(wanted.totalRecords) }] : []),
            { label: "Health", value: issues.length ? `${issues.length} issue${issues.length > 1 ? "s" : ""}` : "OK", tone: hasError ? ("down" as const) : issues.length ? ("warn" as const) : ("ok" as const) },
          ],
          rows: [...(next ? [{ primary: next, secondary: "Next up" }] : []), ...issues.slice(0, 3).map((h) => ({ primary: h.message as string, tone: (h.type === "error" ? "down" : "warn") as "down" | "warn" }))],
        };
      },
    }],
  });
}

const soon = (days = 7) => { const a = new Date(), b = new Date(Date.now() + days * 864e5); return `start=${a.toISOString()}&end=${b.toISOString()}`; };

export const sonarr = arr("sonarr", "Sonarr", "tv", "v3", "Missing", async (ctx) => {
  const c = await get<any[]>(ctx, "v3", `/calendar?${soon()}&includeSeries=true`);
  const e = c.sort((x, y) => String(x.airDateUtc).localeCompare(String(y.airDateUtc)))[0];
  return e ? `${e.series?.title ?? "Episode"} S${String(e.seasonNumber).padStart(2, "0")}E${String(e.episodeNumber).padStart(2, "0")}` : undefined;
});
export const radarr = arr("radarr", "Radarr", "film", "v3", "Missing", async (ctx) => {
  const c = await get<any[]>(ctx, "v3", `/calendar?${soon(30)}`);
  return c[0]?.title;
});
export const lidarr = arr("lidarr", "Lidarr", "music", "v1", "Missing");
export const prowlarr = arr("prowlarr", "Prowlarr", "search", "v1", "");
