import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "node:path";
import { openDb, runMigrations, type Db } from "@/server/db/client";
import { checks, groups, maintenanceWindows, services } from "@/server/db/schema";
import { Scheduler } from "@/server/scheduler/scheduler";
import { activeWindows, covers, maintenanceTick } from "./maintenance";

process.env.HOMI_MIGRATIONS = path.resolve("drizzle");
const sent = vi.fn();
vi.mock("@/server/notify/notify", async (orig) => ({ ...(await orig<typeof import("@/server/notify/notify")>()), notifyTransition: (...a: unknown[]) => sent(...a) }));

describe("maintenance windows", () => {
  let db: Db;
  const T = 1_000_000_000_000, H = 3600_000;
  const win = (id: string, kind: "all" | "group" | "service", targetId: string | null, startsAt: number, endsAt: number) =>
    db.insert(maintenanceWindows).values({ id, name: id, kind, targetId, startsAt, endsAt, createdAt: T }).run();

  beforeEach(() => {
    sent.mockClear();
    db = openDb(":memory:").db; runMigrations(db);
    db.insert(groups).values({ id: "g1", name: "Media", createdAt: 1 }).run();
    const svc = (id: string, groupId: string | null, extra = {}) => db.insert(services).values({ id, name: id, groupId, url: "http://x", createdAt: 1, updatedAt: 1, ...extra }).run();
    const chk = (id: string) => db.insert(checks).values({ id: `c-${id}`, serviceId: id, name: id, type: "http", target: "http://x", lastStatus: "down" }).run();
    svc("plex", "g1"); svc("nas", null); svc("quiet", "g1", { alertsMuted: true });
    chk("plex"); chk("nas"); chk("quiet");
  });

  it("covers by scope", () => {
    expect(covers({ kind: "all", targetId: null }, { id: "x", groupId: null })).toBe(true);
    expect(covers({ kind: "group", targetId: "g1" }, { id: "plex", groupId: "g1" })).toBe(true);
    expect(covers({ kind: "group", targetId: "g1" }, { id: "nas", groupId: null })).toBe(false);
    expect(covers({ kind: "service", targetId: "nas" }, { id: "nas", groupId: null })).toBe(true);
  });

  it("only returns windows that are running now", () => {
    win("past", "all", null, T - 3 * H, T - H); win("now", "all", null, T - H, T + H); win("later", "all", null, T + H, T + 2 * H);
    expect(activeWindows(db, T).map((w) => w.id)).toEqual(["now"]);
  });

  it("holds alerts for covered services only, while checks keep recording", () => {
    db.update(checks).set({ lastStatus: "up" }).run();
    win("w", "group", "g1", Date.now() - H, Date.now() + H);
    const s = new Scheduler(db);
    for (const id of ["c-plex", "c-nas"]) { s.record(id, { ok: false, latencyMs: null }); s.record(id, { ok: false, latencyMs: null }); }
    expect(sent).toHaveBeenCalledTimes(1);
    expect(sent.mock.calls[0][1]).toMatchObject({ name: "nas" }); // plex is in the paused group
    expect(db.select().from(checks).all().find((c) => c.id === "c-plex")!.lastStatus).toBe("down");
  });

  it("announces services still down once a window ends, skipping muted and still-covered ones", async () => {
    win("ended", "group", "g1", T - 2 * H, T - H);
    await maintenanceTick(db, T);
    expect(sent).toHaveBeenCalledTimes(1);
    expect(sent.mock.calls[0][1]).toMatchObject({ kind: "down", name: "plex", error: "still down after maintenance" });
    await maintenanceTick(db, T + 1000);
    expect(sent).toHaveBeenCalledTimes(1); // only once
  });

  it("does not announce while another window still covers the service", async () => {
    win("a", "service", "nas", T - 2 * H, T - H); win("b", "all", null, T - H, T + H);
    await maintenanceTick(db, T);
    expect(sent).not.toHaveBeenCalled();
  });

  it("forgets windows that ended over a week ago", async () => {
    win("old", "all", null, T - 10 * 24 * H, T - 9 * 24 * H);
    await maintenanceTick(db, T);
    expect(db.select().from(maintenanceWindows).all()).toHaveLength(0);
  });
});
