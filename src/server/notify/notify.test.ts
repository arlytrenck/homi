import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { classify, deliver, describe as describeEvent, digestTick, notifyTransition, pruneGroup, readDestinations, routesTo, sealUrl, writeDestinations } from "./notify";
import { openDb, runMigrations } from "@/server/db/client";
import { checks, services, settings } from "@/server/db/schema";
import path from "node:path";
import crypto from "node:crypto";
import { resetMasterKeyForTests } from "@/server/crypto/secretbox";

describe("classify", () => {
  it.each([["up", "down", "down"], ["degraded", "down", "down"], ["down", "up", "recovered"], ["down", "degraded", "recovered"], ["up", "degraded", null], ["unknown", "down", null], ["unknown", "up", null], ["down", "down", null]])("%s → %s = %s", (a, b, want) => {
    expect(classify(a, b)).toBe(want);
  });
});

describe("deliver", () => {
  let srv: http.Server, url: string;
  const got: { headers: http.IncomingHttpHeaders; body: string }[] = [];
  beforeAll(async () => {
    process.env.HOMI_ALLOW_LOOPBACK = "1";
    srv = http.createServer((req, res) => {
      let body = ""; req.on("data", (c) => (body += c));
      req.on("end", () => { got.push({ headers: req.headers, body }); res.statusCode = req.url === "/fail" ? 500 : 200; res.end(); });
    });
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  });
  afterAll(() => srv.close());
  const ev = { kind: "down" as const, name: "Plex", status: "down", previous: "up", error: "timeout", ts: 1 };

  it("webhook posts chat-compatible JSON", async () => {
    await deliver("webhook", `${url}/hook`, ev);
    const j = JSON.parse(got.at(-1)!.body);
    expect(j).toMatchObject({ text: "Plex is down: timeout", content: "Plex is down: timeout", event: "down", service: "Plex" });
  });
  it("ntfy posts plain text with title and priority", async () => {
    await deliver("ntfy", `${url}/topic`, ev);
    expect(got.at(-1)!.body).toBe("Plex is down: timeout");
    expect(got.at(-1)!.headers).toMatchObject({ title: "Plex is down", priority: "high" });
  });
  it("rejects non-2xx", async () => {
    await expect(deliver("webhook", `${url}/fail`, ev)).rejects.toThrow(/500/);
  });
  it("fans out to every enabled destination; one failing does not block the others", async () => {
    process.env.HOMI_MIGRATIONS = path.resolve("drizzle");
    resetMasterKeyForTests(crypto.randomBytes(32));
    const db = openDb(":memory:").db; runMigrations(db);
    writeDestinations(db, [
      { id: "a", kind: "webhook", urlSealed: sealUrl(`${url}/fail`), enabled: true, onRecovery: true },
      { id: "b", kind: "ntfy", urlSealed: sealUrl(`${url}/topic`), enabled: true, onRecovery: true },
      { id: "c", kind: "webhook", urlSealed: sealUrl(`${url}/off`), enabled: false, onRecovery: true },
    ]);
    const before = got.length;
    await notifyTransition(db, ev);
    expect(got.length - before).toBe(2);
    writeDestinations(db, [
      { id: "a", kind: "webhook", urlSealed: sealUrl(`${url}/media`), enabled: true, onRecovery: true, groupIds: ["media"] },
      { id: "b", kind: "webhook", urlSealed: sealUrl(`${url}/infra`), enabled: true, onRecovery: true, groupIds: ["infra"] },
      { id: "c", kind: "webhook", urlSealed: sealUrl(`${url}/all`), enabled: true, onRecovery: true },
    ]);
    const mark = got.length;
    await notifyTransition(db, { ...ev, groupId: "media" });
    expect(got.length - mark).toBe(2); // media + catch-all, not infra
  });
  it("describes recovery with downtime", () => {
    expect(describeEvent({ ...ev, kind: "recovered", status: "up", downForMs: 7 * 60_000 }).text).toBe("Plex is back up after 7 min");
  });
});

describe("destinations storage", () => {
  process.env.HOMI_MIGRATIONS = path.resolve("drizzle");
  it("upgrades the legacy single-destination setting", () => {
    const db = openDb(":memory:").db; runMigrations(db);
    db.insert(settings).values({ key: "notifications", value: { enabled: true, kind: "ntfy", urlSealed: "x", onRecovery: false } as any }).run();
    expect(readDestinations(db)).toEqual([{ id: "d1", kind: "ntfy", urlSealed: "x", enabled: true, onRecovery: false }]);
  });
  it("round-trips several destinations", () => {
    const db = openDb(":memory:").db; runMigrations(db);
    const d = [{ id: "a", kind: "webhook" as const, urlSealed: "1", enabled: true, onRecovery: true }, { id: "b", kind: "ntfy" as const, urlSealed: "2", enabled: false, onRecovery: true }];
    writeDestinations(db, d);
    expect(readDestinations(db)).toEqual(d);
  });
});

describe("group routing", () => {
  it("routes by group; empty means everything; ungrouped is its own target", () => {
    expect(routesTo({}, "g1")).toBe(true);
    expect(routesTo({ groupIds: [] }, null)).toBe(true);
    expect(routesTo({ groupIds: ["g1"] }, "g1")).toBe(true);
    expect(routesTo({ groupIds: ["g1"] }, "g2")).toBe(false);
    expect(routesTo({ groupIds: ["g1"] }, null)).toBe(false);
    expect(routesTo({ groupIds: ["__none__"] }, undefined)).toBe(true);
  });
  it("routes by tag (case-insensitive) or group, whichever matches", () => {
    const d = { groupIds: ["g1"], tags: ["Critical"] };
    expect(routesTo(d, "g2", ["critical"])).toBe(true);
    expect(routesTo(d, "g1", [])).toBe(true);
    expect(routesTo(d, "g2", ["media"])).toBe(false);
    expect(routesTo({ tags: ["x"] }, null, ["x"])).toBe(true);
    expect(routesTo({ tags: ["x"] }, "g1")).toBe(false);
  });
  it("deleting a group removes it from destinations", () => {
    process.env.HOMI_MIGRATIONS = path.resolve("drizzle");
    const db = openDb(":memory:").db; runMigrations(db);
    writeDestinations(db, [{ id: "a", kind: "webhook", urlSealed: "1", enabled: true, onRecovery: true, groupIds: ["g1", "g2"] }, { id: "b", kind: "ntfy", urlSealed: "2", enabled: true, onRecovery: true }]);
    pruneGroup(db, "g1");
    expect(readDestinations(db).map((d) => d.groupIds)).toEqual([["g2"], undefined]);
  });
});

describe("quiet hours", () => {
  let srv: http.Server, url: string;
  const got: string[] = [];
  beforeAll(async () => {
    process.env.HOMI_ALLOW_LOOPBACK = "1";
    process.env.HOMI_MIGRATIONS = path.resolve("drizzle");
    resetMasterKeyForTests(crypto.randomBytes(32));
    srv = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { got.push(b); res.end(); }); });
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  });
  afterAll(() => srv.close());

  const quiet = { enabled: true, start: "22:00", end: "07:00", tz: "UTC", digest: true };
  const dest = (id: string, extra = {}) => ({ id, kind: "webhook" as const, urlSealed: sealUrl(`${url}/${id}`), enabled: true, onRecovery: true, quiet, ...extra });
  const ev = { kind: "down" as const, name: "Plex", status: "down", previous: "up", ts: 1 };

  it("holds alerts for a destination inside its window only", async () => {
    const db = openDb(":memory:").db; runMigrations(db);
    writeDestinations(db, [dest("night"), { ...dest("always"), quiet: undefined }]);
    vi.useFakeTimers(); vi.setSystemTime(Date.parse("2026-01-10T23:00:00Z"));
    const n = got.length;
    await notifyTransition(db, ev);
    expect(got.length - n).toBe(1); // only "always"
    vi.setSystemTime(Date.parse("2026-01-10T12:00:00Z"));
    await notifyTransition(db, ev);
    expect(got.length - n).toBe(3); // both
    vi.useRealTimers();
  });

  it("sends one summary of still-down, routed, unmuted services when the window ends", async () => {
    const db = openDb(":memory:").db; runMigrations(db);
    const t = (iso: string) => Date.parse(iso);
    const svc = (id: string, name: string, extra = {}) => db.insert(services).values({ id, name, url: "http://x", createdAt: 1, updatedAt: 1, ...extra }).run();
    const chk = (id: string, status: "down" | "up", changedAt: number) => db.insert(checks).values({ id: `c-${id}`, serviceId: id, name: id, type: "http", target: "http://x", lastStatus: status, lastChangeAt: changedAt }).run();
    svc("a", "Plex"); chk("a", "down", t("2026-01-10T23:30:00Z"));          // went down in the window
    svc("b", "Old"); chk("b", "down", t("2026-01-09T10:00:00Z"));           // down long before: not part of this summary
    svc("c", "Quiet", { alertsMuted: true }); chk("c", "down", t("2026-01-10T23:40:00Z")); // muted
    svc("d", "Healed"); chk("d", "up", t("2026-01-11T01:00:00Z"));          // recovered
    writeDestinations(db, [dest("digest")]);
    const n = got.length;
    await digestTick(db, t("2026-01-10T21:00:00Z")); // outside: learn state
    await digestTick(db, t("2026-01-10T22:00:00Z")); // window starts
    await digestTick(db, t("2026-01-11T03:00:00Z")); // still inside: nothing
    expect(got.length - n).toBe(0);
    await digestTick(db, t("2026-01-11T07:00:00Z")); // window ended
    expect(got.length - n).toBe(1);
    const j = JSON.parse(got.at(-1)!);
    expect(j).toMatchObject({ event: "digest", services: ["Plex"] });
    await digestTick(db, t("2026-01-11T07:01:00Z")); // no second summary
    expect(got.length - n).toBe(1);
  });
});
