import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";
import crypto from "node:crypto";

process.env.HOMI_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "homi-test-"));
process.env.HOMI_ALLOW_LOOPBACK = "1";
process.env.HOMI_MIGRATIONS = path.resolve("drizzle");

type Handler = (req: http.IncomingMessage, body: string) => unknown;
const routes: Record<string, Handler> = {
  // Pi-hole v6
  "POST /api/auth": (_r, b) => (JSON.parse(b).password === "pw" ? { session: { valid: true, sid: "SID1" } } : null),
  "GET /api/stats/summary": (r) => (r.headers.sid === "SID1" ? { queries: { total: 31482, blocked: 5800, percent_blocked: 18.4 }, clients: { active: 27 }, gravity: { domains_being_blocked: 900000 } } : null),
  // AdGuard
  "GET /control/status": () => ({ version: "v0.107", protection_enabled: true }),
  "GET /control/stats": () => ({ num_dns_queries: 1000, num_blocked_filtering: 250, avg_processing_time: 0.004 }),
  // Uptime Kuma
  "GET /api/status-page/main": () => ({ config: { title: "Status" }, publicGroupList: [{ name: "g", monitorList: [{ id: 1, name: "Plex" }, { id: 2, name: "Radarr" }] }] }),
  "GET /api/status-page/heartbeat/main": () => ({ heartbeatList: { 1: [{ status: 1 }], 2: [{ status: 0 }] }, uptimeList: { "1_24": 1, "2_24": 0.5 } }),
  // *arr
  "GET /api/v3/system/status": (r) => (r.headers["x-api-key"] === "k" ? { version: "4.0.1" } : null),
  "GET /api/v3/queue": () => ({ totalRecords: 3 }),
  "GET /api/v3/wanted/missing": () => ({ totalRecords: 12 }),
  "GET /api/v3/health": () => [{ type: "warning", message: "Indexer unavailable" }],
  "GET /api/v3/calendar": () => [{ airDateUtc: "2026-10-06T00:00:00Z", seasonNumber: 3, episodeNumber: 4, series: { title: "Severance" } }],
  // Proxmox
  "GET /api2/json/version": (r) => (String(r.headers.authorization).startsWith("PVEAPIToken=") ? { data: { version: "8.2" } } : null),
  "GET /api2/json/nodes": () => ({ data: [{ node: "pve1", status: "online", cpu: 0.23, mem: 48 * 2 ** 30, maxmem: 64 * 2 ** 30, uptime: 90000 }] }),
  "GET /api2/json/cluster/resources": () => ({ data: [{ type: "qemu", status: "running" }, { type: "lxc", status: "stopped" }, { type: "lxc", status: "running" }] }),
  // TrueNAS
  "GET /api/v2.0/system/info": () => ({ version: "TrueNAS-25.04", uptime_seconds: 100000 }),
  "GET /api/v2.0/pool": () => [{ name: "tank", status: "ONLINE", size: 36e12, allocated: 22e12 }],
  "GET /api/v2.0/alert/list": () => [{ level: "WARNING", formatted: "Disk temp high", dismissed: false }, { level: "INFO", formatted: "x", dismissed: false }],
  // Grafana
  "GET /api/health": () => ({ database: "ok", version: "11.1.0" }),
  "GET /api/search": () => [{}, {}, {}],
  // Authentik
  "GET /api/v3/admin/version/": () => ({ version_current: "2025.2", outdated: false }),
  "GET /api/v3/core/users/": () => ({ pagination: { count: 8 } }),
  "GET /api/v3/events/events/": () => ({ pagination: { count: 2 } }),
  // UniFi
  "GET /proxy/network/integration/v1/info": () => ({ applicationVersion: "9.0" }),
  "GET /proxy/network/integration/v1/sites": () => ({ data: [{ id: "s1", name: "Default" }] }),
  "GET /proxy/network/integration/v1/sites/s1/devices": () => ({ data: [{ state: "ONLINE" }, { state: "OFFLINE", name: "AP-Garage" }] }),
  "GET /proxy/network/integration/v1/sites/s1/clients": () => ({ totalCount: 41 }),
  // Synology
  "POST /webapi/auth.cgi": (_r, b) => (new URLSearchParams(b).get("passwd") === "pw" ? { success: true, data: { sid: "S" } } : { success: false, error: { code: 400 } }),
  "POST /webapi/entry.cgi": (_r, b) => {
    const api = new URLSearchParams(b).get("api");
    return api === "SYNO.Core.System.Utilization" ? { success: true, data: { cpu: { user_load: 10, system_load: 5 }, memory: { real_usage: 40 } } }
      : { success: true, data: { volumes: [{ id: "volume_1", status: "normal", size: { total: "1000", used: "500" } }] } };
  },
  // Docker (TCP / socket-proxy style)
  "GET /version": () => ({ Version: "27.0" }),
  "GET /containers/json": () => [{ Names: ["/web"], State: "running", Status: "Up 2h" }, { Names: ["/db"], State: "running", Status: "Up (unhealthy)" }, { Names: ["/old"], State: "exited", Status: "Exited" }],
};

let srv: http.Server, base: string;
let rt: typeof import("@/server/integrations/runtime");
let reg: typeof import("@/plugins/registry");

beforeAll(async () => {
  srv = http.createServer((req, res) => {
    let body = ""; req.on("data", (c) => (body += c));
    req.on("end", () => {
      const key = `${req.method} ${req.url!.split("?")[0]}`;
      const h = routes[key];
      const out = h ? h(req, body) : undefined;
      if (out === undefined) { res.writeHead(404); return res.end("{}"); }
      if (out === null) { res.writeHead(401); return res.end("{}"); }
      res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(out));
    });
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  const sb = await import("@/server/crypto/secretbox");
  sb.resetMasterKeyForTests(crypto.randomBytes(32));
  rt = await import("@/server/integrations/runtime");
  reg = await import("@/plugins/registry");
});
afterAll(() => srv.close());

const run = async (type: string, widget: string, secrets: Record<string, string>, config: Record<string, any> = {}, options: Record<string, any> = {}) => {
  const ctx = rt.buildContext(`t:${type}`, { baseUrl: base, config, secrets, ignoreTls: false });
  return (reg.widgetRegistry[widget] as import("@/plugins/sdk").WidgetDef).fetch(ctx, options);
};
const test = (type: string, secrets: Record<string, string>, config: Record<string, any> = {}) => rt.testIntegration(type, { baseUrl: base, config, secrets, ignoreTls: false });

describe("integrations against mock APIs", () => {
  it("pihole v6", async () => {
    expect(await test("pihole", { password: "pw" })).toMatchObject({ ok: true, version: "v6" });
    expect(await test("pihole", { password: "bad" })).toMatchObject({ ok: false });
    const o = await run("pihole", "pihole.summary", { password: "pw" });
    expect(o.stats?.[0]).toEqual({ label: "Queries", value: "31,482" });
    expect(o.stats?.[1].value).toBe("18.4%");
  });
  it("adguard", async () => {
    const o = await run("adguard", "adguard.summary", { password: "x" }, { username: "u" });
    expect(o.stats?.[1].value).toBe("25.0%");
    expect(o.note).toBe("Protection enabled");
  });
  it("uptimekuma", async () => {
    const o = await run("uptimekuma", "uptimekuma.status", {}, { slug: "main" });
    expect(o.stats?.find((s) => s.label === "Down")?.value).toBe("1");
    expect(o.rows?.[0]).toMatchObject({ primary: "Radarr", tone: "down" });
  });
  it("sonarr (queue, wanted, health, calendar)", async () => {
    expect(await test("sonarr", { apiKey: "k" })).toMatchObject({ ok: true, version: "4.0.1" });
    expect(await test("sonarr", { apiKey: "wrong" })).toMatchObject({ ok: false, error: expect.stringContaining("Authentication") });
    const o = await run("sonarr", "sonarr.summary", { apiKey: "k" });
    expect(o.stats?.map((s) => s.value)).toEqual(["3", "12", "1 issue"]);
    expect(o.rows?.[0]).toEqual({ primary: "Severance S03E04", secondary: "Next up" });
  });
  it("proxmox", async () => {
    const o = await run("proxmox", "proxmox.cluster", { tokenId: "a@pve!b", tokenSecret: "s" });
    expect(o.meters?.[0].text).toBe("23%");
    expect(o.stats?.[0].value).toBe("2 / 3");
  });
  it("truenas", async () => {
    const o = await run("truenas", "truenas.pools", { apiKey: "k" });
    expect(o.meters?.[0].label).toBe("tank (ONLINE)");
    expect(o.stats?.[0]).toMatchObject({ label: "Alerts", value: "1", tone: "warn" });
  });
  it("grafana (with and without token)", async () => {
    expect((await run("grafana", "grafana.status", {})).stats).toHaveLength(1);
    expect((await run("grafana", "grafana.status", { token: "t" })).stats?.[1].value).toBe("3");
  });
  it("authentik", async () => {
    const o = await run("authentik", "authentik.summary", { token: "t" });
    expect(o.stats?.map((s) => s.value)).toEqual(["8", "2"]);
  });
  it("unifi", async () => {
    const o = await run("unifi", "unifi.network", { apiKey: "k" });
    expect(o.stats?.[0]).toMatchObject({ value: "1 / 2", tone: "warn" });
    expect(o.rows?.[0].primary).toBe("AP-Garage");
  });
  it("synology", async () => {
    expect(await test("synology", { password: "bad" }, { username: "u" })).toMatchObject({ ok: false, error: expect.stringContaining("login failed") });
    const o = await run("synology", "synology.system", { password: "pw" }, { username: "u" });
    expect(o.meters?.[0].text).toBe("15%");
    expect(o.meters?.[2].value).toBe(0.5);
  });
  it("docker (tcp / socket proxy)", async () => {
    const o = await run("docker", "docker.containers", {});
    expect(o.stats?.[0].value).toBe("2 / 3");
    expect(o.rows?.[0].primary).toBe("db");
  });
  it("reports missing required fields without calling the API", async () => {
    expect(await test("sonarr", {})).toEqual({ ok: false, error: "API key (Settings > General) is required" });
  });
  it("blocks metadata addresses for integrations", async () => {
    const r = await rt.testIntegration("grafana", { baseUrl: "http://169.254.169.254", config: {}, secrets: {}, ignoreTls: false });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).toMatch(/Blocked/);
  });
});

describe("secret handling", () => {
  it("seals secrets and never exposes values in DTOs", async () => {
    const store = await import("@/server/integrations/store");
    const { getDb, runMigrations } = await import("@/server/db/client");
    runMigrations(getDb());
    const id = store.createIntegration({ type: "sonarr", name: "S", baseUrl: base, config: {}, secrets: { apiKey: "TOPSECRET" }, ignoreTls: false, enabled: true });
    const { integrations } = await import("@/server/db/schema");
    const row = getDb().select().from(integrations).get()!;
    expect(row.secrets).not.toContain("TOPSECRET");
    const dto = store.toDto(row);
    expect(JSON.stringify(dto)).not.toContain("TOPSECRET");
    expect(dto.secrets).toEqual({ apiKey: { set: true } });
    store.updateIntegration(id, { name: "S2" });
    expect(rt.openSecrets(getDb().select().from(integrations).get()!)).toEqual({ apiKey: "TOPSECRET" });
    store.updateIntegration(id, { secrets: { apiKey: null } });
    expect(store.toDto(getDb().select().from(integrations).get()!).secrets).toEqual({});
  });
});
