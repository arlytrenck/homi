import { eq } from "drizzle-orm";
import { describe, it, expect, beforeEach } from "vitest";
import { openDb, runMigrations, type Db } from "@/server/db/client";
import { checks, checkResults, checkRollups, services } from "@/server/db/schema";
import { Scheduler, nextStatus } from "./scheduler";
import { statusMatches, certOutcome } from "@/server/checks/runner";
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
  it("drops buffered results of a deleted check instead of throwing", () => {
    db.insert(checks).values({ id: "c2", serviceId: null, name: "gone", type: "http", target: "http://y" }).run();
    s.record("c1", { ok: true, latencyMs: 1 });
    s.record("c2", { ok: true, latencyMs: 1 });
    db.delete(checks).where(eq(checks.id, "c2")).run();
    expect(() => s.flush()).not.toThrow();
    expect(db.select().from(checkResults).all().map((r) => r.checkId)).toEqual(["c1"]);
  });
  it("prunes raw results older than retention but keeps rollups", () => {
    const old = Date.now() - 100 * 3600_000;
    s.record("c1", { ok: true, latencyMs: 1 }, old);
    s.maintenance();
    expect(db.select().from(checkResults).all()).toHaveLength(0);
    expect(db.select().from(checkRollups).all()).toHaveLength(1);
  });
});

describe("heartbeat checks", () => {
  let db: Db, s: Scheduler;
  const dispatch = (now: number) => (s as unknown as { dispatch(n: number): void }).dispatch(now);
  const row = () => db.select().from(checks).where(eq(checks.id, "h1")).get()!;
  beforeEach(() => {
    db = openDb(":memory:").db; runMigrations(db); s = new Scheduler(db);
    const now = Date.now();
    db.insert(services).values({ id: "sh", name: "Backup", url: "http://x", createdAt: now, updatedAt: now }).run();
    db.insert(checks).values({ id: "h1", serviceId: "sh", name: "Backup", type: "heartbeat", target: "heartbeat", intervalS: 100, token: "tok" }).run();
  });

  it("stays unknown until the first ping", () => {
    dispatch(Date.now() + 10 * 3600_000);
    expect(row().lastStatus).toBe("unknown");
  });
  it("goes down immediately once overdue (interval + 25%), and recovers on the next ping", () => {
    const t0 = 1_000_000_000_000;
    db.update(checks).set({ lastPingAt: t0 }).where(eq(checks.id, "h1")).run();
    s.record("h1", { ok: true, latencyMs: null }, t0);
    dispatch(t0 + 124_000);
    expect(row().lastStatus).toBe("up"); // 124s < 125s
    s.reload("h1"); // make the check due again
    dispatch(t0 + 126_000);
    expect(row()).toMatchObject({ lastStatus: "down" });
    db.update(checks).set({ lastPingAt: t0 + 130_000 }).where(eq(checks.id, "h1")).run();
    s.record("h1", { ok: true, latencyMs: null }, t0 + 130_000);
    expect(row().lastStatus).toBe("up");
  });
  it("an explicit failure report is down on the first report", () => {
    s.record("h1", { ok: true, latencyMs: null });
    s.record("h1", { ok: false, latencyMs: null, error: "exit 1", immediate: true });
    expect(row().lastStatus).toBe("down");
  });
});

describe("certOutcome", () => {
  const now = Date.parse("2026-06-01T00:00:00Z");
  const at = (days: number) => new Date(now + days * 86_400_000).toUTCString();
  it("is up with plenty of validity left", () => {
    expect(certOutcome(at(60), 12, now)).toEqual({ ok: true, latencyMs: 12 });
  });
  it("is degraded inside the warning window and says how long is left", () => {
    expect(certOutcome(at(5), 12, now)).toMatchObject({ ok: true, degraded: true, error: "certificate expires in 5 day(s)" });
    expect(certOutcome(at(13.5), 12, now)).toMatchObject({ degraded: true });
    expect(certOutcome(at(14.5), 12, now).degraded).toBeUndefined();
  });
  it("is down once expired", () => {
    expect(certOutcome(at(-3), 12, now)).toMatchObject({ ok: false, error: "certificate expired 3 day(s) ago" });
    expect(certOutcome(at(-0.1), 12, now)).toMatchObject({ ok: false });
  });
  it("fails on an unreadable date", () => {
    expect(certOutcome("garbage", 1, now).ok).toBe(false);
  });
});
