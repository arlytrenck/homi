import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "node:path";
import { eq } from "drizzle-orm";
import { openDb, runMigrations, type Db } from "@/server/db/client";
import { checks, incidents, services } from "@/server/db/schema";
import { Scheduler } from "@/server/scheduler/scheduler";
import { descendants, downAncestor, wouldCycle } from "./dependencies";

process.env.HOMI_MIGRATIONS = path.resolve("drizzle");
const sent = vi.fn();
vi.mock("@/server/notify/notify", async (orig) => ({ ...(await orig<typeof import("@/server/notify/notify")>()), notifyTransition: (...a: unknown[]) => sent(...a) }));

describe("dependencies", () => {
  let db: Db, s: Scheduler;
  // nas <- docker <- plex ;  router (independent)
  beforeEach(() => {
    sent.mockClear();
    db = openDb(":memory:").db; runMigrations(db); s = new Scheduler(db);
    const svc = (id: string, dependsOnId: string | null) => {
      db.insert(services).values({ id, name: id, url: "http://x", dependsOnId, createdAt: 1, updatedAt: 1 }).run();
      db.insert(checks).values({ id: `c-${id}`, serviceId: id, name: id, type: "http", target: "http://x", lastStatus: "up" }).run();
    };
    svc("nas", null); svc("docker", "nas"); svc("plex", "docker"); svc("router", null);
  });
  const fail = (id: string) => { s.record(`c-${id}`, { ok: false, latencyMs: null }); s.record(`c-${id}`, { ok: false, latencyMs: null }); };
  const ok = (id: string) => s.record(`c-${id}`, { ok: true, latencyMs: 5 });
  const names = () => sent.mock.calls.map((c) => `${c[1].kind}:${c[1].name}`);

  it("walks the chain to the nearest down ancestor, and survives a loop", () => {
    expect(downAncestor(db, "plex")).toBeNull();
    db.update(checks).set({ lastStatus: "down" }).where(eq(checks.id, "c-nas")).run();
    expect(downAncestor(db, "plex")).toEqual({ id: "nas", name: "nas" });
    db.update(services).set({ dependsOnId: "plex" }).where(eq(services.id, "nas")).run(); // nas <-> plex loop
    expect(() => downAncestor(db, "plex")).not.toThrow();
  });

  it("finds descendants and refuses loops", () => {
    expect(descendants(db, "nas").sort()).toEqual(["docker", "plex"]);
    expect(descendants(db, "router")).toEqual([]);
    expect(wouldCycle(db, "nas", "plex")).toBe(true);
    expect(wouldCycle(db, "nas", "nas")).toBe(true);
    expect(wouldCycle(db, "plex", "router")).toBe(false);
  });

  it("one alert for the root cause; dependents stay quiet but get incidents marked as affected", () => {
    fail("nas"); fail("plex"); fail("router");
    expect(names()).toEqual(["down:nas", "down:router"]);
    const plex = db.select().from(incidents).all().find((i) => i.serviceName === "plex")!;
    expect(plex).toMatchObject({ affectedBy: "nas", endedAt: null });
    expect(db.select().from(incidents).all().find((i) => i.serviceName === "nas")!.affectedBy).toBeNull();
  });

  it("announces dependents that are still down when the root cause recovers", () => {
    fail("nas"); fail("plex"); fail("docker");
    sent.mockClear();
    db.update(checks).set({ lastStatus: "up", consecutiveFailures: 0 }).where(eq(checks.id, "c-docker")).run(); // docker healed on its own
    ok("nas");
    expect(names()).toEqual(["recovered:nas", "down:plex"]);
    expect(sent.mock.calls[1][1].error).toBe("still down after nas recovered");
  });

  it("closes the incident when the service comes back", () => {
    fail("router");
    ok("router");
    const i = db.select().from(incidents).get()!;
    expect(i.endedAt).not.toBeNull();
  });
});
