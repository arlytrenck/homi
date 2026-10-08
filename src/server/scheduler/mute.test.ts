import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { openDb, runMigrations, type Db } from "@/server/db/client";
import { checks, services } from "@/server/db/schema";
import { Scheduler } from "./scheduler";
import path from "node:path";

process.env.HOMI_MIGRATIONS = path.resolve("drizzle");
const sent = vi.fn();
vi.mock("@/server/notify/notify", async (orig) => ({ ...(await orig<typeof import("@/server/notify/notify")>()), notifyTransition: (...a: unknown[]) => sent(...a) }));

describe("alert muting", () => {
  let db: Db, s: Scheduler;
  beforeEach(() => {
    sent.mockClear();
    db = openDb(":memory:").db; runMigrations(db); s = new Scheduler(db);
    const now = Date.now();
    db.insert(services).values({ id: "s1", name: "x", url: "http://x", createdAt: now, updatedAt: now }).run();
    db.insert(checks).values({ id: "c1", serviceId: "s1", name: "x", type: "http", target: "http://x", lastStatus: "up" }).run();
  });
  const down = () => { s.record("c1", { ok: false, latencyMs: null }); s.record("c1", { ok: false, latencyMs: null }); };

  it("alerts when a service goes down", () => {
    down();
    expect(sent).toHaveBeenCalledTimes(1);
    expect(sent.mock.calls[0][1]).toMatchObject({ kind: "down", name: "x" });
  });
  it("stays silent for a muted service", () => {
    db.update(services).set({ alertsMuted: true }).where(eq(services.id, "s1")).run();
    down();
    expect(sent).not.toHaveBeenCalled();
    expect(db.select().from(checks).get()!.lastStatus).toBe("down"); // still monitored
  });
});
