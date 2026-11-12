import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import { openDb, runMigrations, type Db } from "@/server/db/client";
import { checkResults, checkRollups, checks, incidents, services } from "@/server/db/schema";
import { dailyUptime, statusPageData, STATUS_DAYS } from "./statusPage";
import { banner } from "@/lib/status";

process.env.HOMI_MIGRATIONS = path.resolve("drizzle");
const DAY = 86_400_000, H = 3600_000;

describe("status page data", () => {
  let db: Db;
  const now = Date.parse("2026-06-15T12:30:00Z");
  const today = Math.floor(now / DAY) * DAY;
  beforeEach(() => {
    db = openDb(":memory:").db; runMigrations(db);
    const svc = (id: string, extra = {}) => { db.insert(services).values({ id, name: id, url: "http://x", createdAt: 1, updatedAt: 1, ...extra }).run(); db.insert(checks).values({ id: `c-${id}`, serviceId: id, name: id, type: "http", target: "http://x", lastStatus: "up" }).run(); };
    svc("plex"); svc("secret", { hiddenPublic: true });
  });

  it("builds 90 days, combining hourly rollups and not-yet-rolled raw rows without double counting", () => {
    db.insert(checkRollups).values([
      { checkId: "c-plex", bucketTs: today - 2 * DAY, samples: 100, ups: 100, avgLatency: 5 },
      { checkId: "c-plex", bucketTs: today - DAY, samples: 100, ups: 90, avgLatency: 5 },
      { checkId: "c-plex", bucketTs: today - DAY + H, samples: 100, ups: 100, avgLatency: 5 },
      { checkId: "c-plex", bucketTs: today + 11 * H, samples: 60, ups: 60, avgLatency: 5 }, // rolled hour 11:00
    ]).run();
    db.insert(checkResults).values([
      { checkId: "c-plex", ts: today + 11 * H + 5000, ok: true, latencyMs: 1 },   // inside the rolled hour: ignore
      { checkId: "c-plex", ts: today + 12 * H + 5000, ok: false, latencyMs: null }, // after the last bucket: count
    ]).run();
    const d = dailyUptime(db, ["c-plex"], now).get("c-plex")!;
    expect(d).toHaveLength(STATUS_DAYS);
    expect(d.at(-1)!.day).toBe(today);
    expect(d.at(-3)!.ratio).toBe(1);
    expect(d.at(-2)!.ratio).toBeCloseTo(190 / 200);
    expect(d.at(-1)!.ratio).toBeCloseTo(60 / 61); // 60 rolled + 1 raw failure
    expect(d[0].ratio).toBeNull();
  });

  it("publishes only non-hidden monitored services and their incidents, without error details", () => {
    db.insert(incidents).values([
      { id: "i1", checkId: "c-plex", serviceName: "plex", startedAt: now - H, endedAt: null, error: "connect ECONNREFUSED 10.0.0.5" },
      { id: "i2", checkId: "c-secret", serviceName: "secret", startedAt: now - H, endedAt: null },
      { id: "i3", checkId: "c-plex", serviceName: "plex", startedAt: now - 20 * DAY, endedAt: now - 20 * DAY + H }, // too old
    ]).run();
    const out = statusPageData(db, now);
    expect(out.services.map((s) => s.id)).toEqual(["plex"]);
    expect(out.incidents.map((i) => i.id)).toEqual(["i1"]);
    expect(JSON.stringify(out)).not.toContain("ECONNREFUSED");
    expect(JSON.stringify(out)).not.toContain("secret");
  });
});

describe("banner", () => {
  const s = (status: "up" | "down" | "degraded", maintenance = false) => ({ status, maintenance });
  it("summarises", () => {
    expect(banner([s("up"), s("up")])).toEqual({ tone: "ok", text: "All systems operational" });
    expect(banner([s("up"), s("down")])).toEqual({ tone: "down", text: "1 service is down" });
    expect(banner([s("down"), s("down")]).text).toBe("Major outage");
    expect(banner([s("up"), s("degraded")]).tone).toBe("warn");
  });
  it("ignores services in maintenance", () => {
    expect(banner([s("up"), s("down", true)])).toEqual({ tone: "warn", text: "Scheduled maintenance in progress" });
  });
});
