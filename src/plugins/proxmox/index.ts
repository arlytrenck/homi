import { clamp01, definePlugin, bytes, duration, pct } from "../sdk";

const hdr = (s: Record<string, string>) => ({ authorization: `PVEAPIToken=${s.tokenId}=${s.tokenSecret}` });

export default definePlugin({
  id: "proxmox", name: "Proxmox VE", icon: "server", description: "Node load plus VM and LXC counts. Use a read-only API token (PVEAuditor).",
  baseUrlPlaceholder: "https://192.168.1.10:8006",
  secrets: {
    tokenId: { kind: "secret", label: "Token ID (user@realm!name)", required: true },
    tokenSecret: { kind: "secret", label: "Token secret", required: true },
  },
  async test(ctx) { try { const v = await ctx.json<any>("/api2/json/version", { headers: hdr(ctx.secrets) }); return { ok: true, version: v.data?.version }; } catch (e) { return { ok: false, error: (e as Error).message }; } },
  widgets: [{
    id: "proxmox.cluster", title: "Proxmox", options: { node: { kind: "text", label: "Only this node (optional)" } },
    async fetch(ctx, o) {
      const h = hdr(ctx.secrets);
      const [nodes, res] = await Promise.all([ctx.json<any>("/api2/json/nodes", { headers: h }), ctx.json<any>("/api2/json/cluster/resources?type=vm", { headers: h })]);
      const list: any[] = (nodes.data ?? []).filter((n: any) => !o.node || n.node === o.node);
      const vms: any[] = (res.data ?? []).filter((r: any) => !o.node || r.node === o.node);
      const cpu = list.reduce((a, n) => a + (n.cpu ?? 0), 0) / Math.max(1, list.length);
      const mem = list.reduce((a, n) => a + (n.mem ?? 0), 0), maxmem = list.reduce((a, n) => a + (n.maxmem ?? 0), 0);
      const running = vms.filter((v) => v.status === "running").length;
      const offline = list.filter((n) => n.status !== "online");
      return {
        meters: [{ label: "CPU", value: clamp01(cpu), text: pct(cpu * 100) }, { label: "Memory", value: clamp01(mem / (maxmem || 1)), text: `${bytes(mem)} / ${bytes(maxmem)}` }],
        stats: [{ label: "Guests running", value: `${running} / ${vms.length}` }, { label: "Nodes online", value: `${list.length - offline.length} / ${list.length}`, tone: offline.length ? "down" : "ok" }],
        note: list[0]?.uptime ? `Uptime ${duration(list[0].uptime)}` : undefined,
      };
    },
  }],
});
