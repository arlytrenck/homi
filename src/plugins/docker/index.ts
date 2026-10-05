import { Agent, request } from "undici";
import { definePlugin, type IntegrationContext, type Tone } from "../sdk";

/**
 * baseUrl is either "unix:///var/run/docker.sock" (talks to the socket directly) or an
 * http(s) URL for a TCP endpoint / docker-socket-proxy (goes through the SSRF-guarded client).
 * Only read-only list endpoints are ever called.
 */
async function docker<T>(ctx: IntegrationContext, path: string): Promise<T> {
  if (ctx.baseUrl.startsWith("unix://")) {
    const agent = new Agent({ connect: { socketPath: ctx.baseUrl.slice(7) } });
    try {
      const r = await request(`http://docker${path}`, { dispatcher: agent, headersTimeout: 8000 });
      const text = await r.body.text();
      if (r.statusCode >= 400) throw new Error(`Docker API ${r.statusCode}`);
      return JSON.parse(text) as T;
    } finally { await agent.close(); }
  }
  return ctx.json<T>(path);
}

export default definePlugin({
  id: "docker", name: "Docker", icon: "container", description: "Container states. Prefer a docker-socket-proxy with CONTAINERS=1 only.",
  baseUrlPlaceholder: "unix:///var/run/docker.sock",
  secrets: {},
  async test(ctx) { try { const v = await docker<any>(ctx, "/version"); return { ok: true, version: v.Version }; } catch (e) { return { ok: false, error: (e as Error).message }; } },
  widgets: [{
    id: "docker.containers", title: "Docker", options: { showStopped: { kind: "boolean", label: "List stopped containers" } },
    async fetch(ctx, o) {
      const list = await docker<any[]>(ctx, "/containers/json?all=1");
      const running = list.filter((c) => c.State === "running");
      const bad = list.filter((c) => c.State !== "running" || /unhealthy/.test(c.Status ?? ""));
      return {
        stats: [{ label: "Running", value: `${running.length} / ${list.length}` }, { label: "Attention", value: String(bad.length), tone: bad.length ? "warn" : "ok" }],
        rows: (o.showStopped ? bad : bad.filter((c) => /unhealthy/.test(c.Status ?? "") || c.State === "restarting" || c.State === "dead")).slice(0, 6).map((c) => ({ primary: String(c.Names?.[0] ?? c.Id).replace(/^\//, ""), secondary: c.Status, tone: (c.State === "running" ? "warn" : "down") as Tone })),
      };
    },
  }],
});
