import "server-only";
import { and, eq, gt, lte, lt } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { checks, maintenanceSchedules, maintenanceWindows, services } from "@/server/db/schema";
import { notifyTransition } from "@/server/notify/notify";
import { activeOccurrence, lastEndedOccurrence } from "@/server/schedule";
import { pruneIncidents } from "@/server/incidents";

export type Window = typeof maintenanceWindows.$inferSelect;
const DAY = 86_400_000;

type Schedule = typeof maintenanceSchedules.$inferSelect;
const rec = (s: Schedule) => ({ days: s.days, startTime: s.startTime, durationMin: s.durationMin, tz: s.tz });

/** One-off windows running now, plus the current occurrence of every enabled weekly schedule (as windows). */
export const activeWindows = (db: Db, now = Date.now()): Window[] => {
  const oneOff = db.select().from(maintenanceWindows).where(and(lte(maintenanceWindows.startsAt, now), gt(maintenanceWindows.endsAt, now))).all();
  const recurring = db.select().from(maintenanceSchedules).where(eq(maintenanceSchedules.enabled, true)).all().flatMap((s): Window[] => {
    const o = activeOccurrence(rec(s), now);
    return o ? [{ id: `schedule:${s.id}`, name: s.name, kind: s.kind, targetId: s.targetId, startsAt: o.start, endsAt: o.end, endHandled: true, createdAt: s.createdAt }] : [];
  });
  return [...oneOff, ...recurring];
};

export const covers = (w: Pick<Window, "kind" | "targetId">, svc: { id: string; groupId: string | null }) =>
  w.kind === "all" || (w.kind === "service" && w.targetId === svc.id) || (w.kind === "group" && w.targetId === svc.groupId);

export const inMaintenance = (wins: Pick<Window, "kind" | "targetId">[], svc: { id: string; groupId: string | null }) => wins.some((w) => covers(w, svc));

/**
 * Alerts are held during a window, so a service that is still down when it ends would never be announced.
 * Send that follow-up once, and forget windows that ended over a week ago.
 */
export async function maintenanceTick(db: Db, now = Date.now()): Promise<void> {
  const ended: Pick<Window, "id" | "kind" | "targetId">[] = db.select().from(maintenanceWindows).where(and(lte(maintenanceWindows.endsAt, now), eq(maintenanceWindows.endHandled, false))).all();
  for (const w of ended) db.update(maintenanceWindows).set({ endHandled: true }).where(eq(maintenanceWindows.id, w.id)).run();
  for (const sc of db.select().from(maintenanceSchedules).where(eq(maintenanceSchedules.enabled, true)).all()) {
    const last = lastEndedOccurrence(rec(sc), now);
    if (!last || last.end <= sc.handledUntil) continue;
    db.update(maintenanceSchedules).set({ handledUntil: last.end }).where(eq(maintenanceSchedules.id, sc.id)).run();
    ended.push(sc);
  }
  if (ended.length) {
    const still = activeWindows(db, now);
    const rows = db.select({ id: services.id, name: services.name, groupId: services.groupId, tags: services.tags, muted: services.alertsMuted, status: checks.lastStatus, target: checks.target })
      .from(checks).innerJoin(services, eq(services.id, checks.serviceId)).where(eq(checks.lastStatus, "down")).all();
    for (const w of ended) {
      for (const r of rows) {
        if (r.muted || !covers(w, r) || inMaintenance(still, r)) continue;
        await notifyTransition(db, { kind: "down", name: r.name, status: "down", previous: "down", target: r.target, error: "still down after maintenance", groupId: r.groupId, tags: r.tags, ts: now });
      }
    }
  }
  db.delete(maintenanceWindows).where(lt(maintenanceWindows.endsAt, now - 7 * DAY)).run();
  pruneIncidents(db, now);
}
