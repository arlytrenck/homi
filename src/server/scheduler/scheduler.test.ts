import { describe, it, expect, beforeEach } from "vitest";
import { openDb, runMigrations } from "@/server/db/client";
import { checks, checkResults, checkRollups, services } from "@/server/db/schema";
import { Scheduler, nextStatus } from "./scheduler";
import { statusMatches } from "@/server/checks/runner";
import path from "node:path";

process.env.HOMI_MIGRATIONS = path.resolve("drizzle");

describe("nextStatus", () => {
  it("requires 2 consecutive failures to go down from up", () => {
    const a = nextStatus("up", 0, { ok: false, latencyMs: null });
    expect(a).toEqual({ status: "up", failures: 1 });
    expect(nextStatus("up", a.failures, { ok: false, latencyMs: null }).status).toBe("down");
  });
  it("first result for unknown service is immediate", () => {
    expect(nextStatus("unknown", 0, { ok: false, latencyMs: null }).status).toBe("down");
  });
  it("recovers and flags degraded", () => {
    expect(nextStatus("down", 5, { ok: true, latencyMs: 5 })).toEqual({ status: "up", failures: 0 });
    expect(nextStatus("up", 0, { ok: true, degraded: true, latencyMs: 5 }).status).toBe("degraded");
  });
});

describe("statusMatches", () => {
  it("handles ranges and singles", () => {
    expect(statusMatches(204, "200-399")).toBe(true);
    expect(statusMatches(404, "200-399")).toBe(false);
    expect(statusMatches(401, "401")).toBe(true);
  });
});

describe("Scheduler.record / maintenance", () => {
  let db: ReturnType<typeof openDb>["db"]; let s: Scheduler;
  beforeEach(() => {
    db = openDb(":memory:").db; runMigrations(db); s = new Scheduler(db);
    const now = Date.now();
    db.insert(services).values({ id: "s1", name: "x", url: "http://x", createdAt: now, updatedAt: now }).run();
    db.insert(checks).values({ id: "c1", serviceId: "s1", name: "x", type: "http", target: "http://x" }).run();
  });
  it("records transitions and rolls up hourly buckets", () => {
    const H = 3600_000, base = Math.floor(Date.now() / H) * H - 3 * H;
    s.record("c1", { ok: true, latencyMs: 10 }, base + 1000);
    s.record("c1", { ok: true, latencyMs: 30 }, base + 2000);
    s.record("c1", { ok: false, latencyMs: null }, base + 3000);
    s.maintenance();
    const r = db.select().from(checkRollups).all();
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ samples: 3, ups: 2 });
    expect(db.select().from(checkResults).all()).toHaveLength(3);
    expect(db.select().from(checks).get()!.lastStatus).toBe("up");
  });
  it("prunes raw results older than retention but keeps rollups", () => {
    const old = Date.now() - 100 * 3600_000;
    s.record("c1", { ok: true, latencyMs: 1 }, old);
    s.maintenance();
    expect(db.select().from(checkResults).all()).toHaveLength(0);
    expect(db.select().from(checkRollups).all()).toHaveLength(1);
  });
});
