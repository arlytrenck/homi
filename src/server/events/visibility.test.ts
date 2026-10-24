import { describe, it, expect } from "vitest";
import path from "node:path";
import { openDb, runMigrations } from "@/server/db/client";
import { checks, services } from "@/server/db/schema";
import { visibleToPublic } from "./visibility";

process.env.HOMI_MIGRATIONS = path.resolve("drizzle");

describe("visibleToPublic", () => {
  const db = openDb(":memory:").db; runMigrations(db);
  db.insert(services).values([{ id: "s1", name: "Open", url: "http://a", createdAt: 1, updatedAt: 1 }, { id: "s2", name: "Secret", url: "http://b", hiddenPublic: true, createdAt: 1, updatedAt: 1 }]).run();
  db.insert(checks).values([{ id: "c1", serviceId: "s1", name: "Open", type: "http", target: "http://a" }, { id: "c2", serviceId: "s2", name: "Secret", type: "http", target: "http://b" }] as never).run();
  const ev = (checkId: string) => ({ type: "status" as const, checkId, status: "down", latencyMs: null, ts: 1 });
  it("passes status for public services only", () => {
    expect(visibleToPublic(db, ev("c1"))).toBe(true);
    expect(visibleToPublic(db, ev("c2"))).toBe(false);
    expect(visibleToPublic(db, ev("gone"))).toBe(false);
  });
  it("passes config-changed, drops hoststats", () => {
    expect(visibleToPublic(db, { type: "config-changed" })).toBe(true);
    expect(visibleToPublic(db, { type: "hoststats", data: {} })).toBe(false);
  });
});
