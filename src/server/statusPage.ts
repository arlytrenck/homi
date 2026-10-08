import "server-only";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { checkResults, checkRollups, checks, groups, incidents, services } from "@/server/db/schema";
import { activeWindows, inMaintenance } from "@/server/maintenance";

const H = 3600_000, DAY = 24 * H;
export const STATUS_DAYS = 90;

export interface DayUptime { day: number; ratio: number | null }

/** Per-check, per-UTC-day uptime for the last STATUS_DAYS days: hourly rollups, plus raw rows the rollup has not absorbed yet. */
export function dailyUptime(db: Db, checkIds: string[], now = Date.now()): Map<string, DayUptime[]> {
  const today = Math.floor(now / DAY) * DAY, first = today - (STATUS_DAYS - 1) * DAY;
  const acc = new Map<string, Map<number, { n: number; up: number }>>();
  const add = (id: string, ts: number, n: number, up: number) => {
    const day = Math.floor(ts / DAY) * DAY;
    const m = acc.get(id) ?? acc.set(id, new Map()).get(id)!;
    const cur = m.get(day) ?? { n: 0, up: 0 };
    cur.n += n; cur.up += up; m.set(day, cur);
  };
  const lastBucket = new Map<string, number>();
  for (const r of db.select().from(checkRollups).where(gte(checkRollups.bucketTs, first)).all()) {
    add(r.checkId, r.bucketTs, r.samples, r.ups);
    lastBucket.set(r.checkId, Math.max(lastBucket.get(r.checkId) ?? 0, r.bucketTs));
  }
  for (const r of db.select({ id: checkResults.checkId, ts: checkResults.ts, ok: checkResults.ok }).from(checkResults).where(gte(checkResults.ts, now - 3 * H)).all()) {
    if (r.ts >= (lastBucket.get(r.id) ?? 0) + H) add(r.id, r.ts, 1, r.ok ? 1 : 0);
  }
  const out = new Map<string, DayUptime[]>();
  for (const id of checkIds) {
    const m = acc.get(id);
    out.set(id, Array.from({ length: STATUS_DAYS }, (_, i) => { const day = first + i * DAY; const v = m?.get(day); return { day, ratio: v && v.n ? v.up / v.n : null }; }));
  }
  return out;
}

export function statusPageData(db: Db, now = Date.now()) {
  const gs = db.select().from(groups).orderBy(asc(groups.sort)).all();
  const ss = db.select().from(services).where(eq(services.hiddenPublic, false)).orderBy(asc(services.sort)).all();
  const cs = new Map(db.select().from(checks).all().map((c) => [c.serviceId, c]));
  const monitored = ss.filter((s) => cs.get(s.id));
  const days = dailyUptime(db, monitored.map((s) => cs.get(s.id)!.id), now);
  const wins = activeWindows(db, now);
  const items = monitored.map((s) => {
    const c = cs.get(s.id)!, d = days.get(c.id)!;
    const known = d.filter((x) => x.ratio !== null);
    return { id: s.id, name: s.name, groupId: s.groupId, status: c.lastStatus, maintenance: inMaintenance(wins, s), days: d, uptime: known.length ? known.reduce((a, x) => a + x.ratio!, 0) / known.length : null };
  });
  const hidden = new Set(db.select({ id: checks.id }).from(checks).innerJoin(services, eq(services.id, checks.serviceId)).where(eq(services.hiddenPublic, true)).all().map((r) => r.id));
  const recent = db.select().from(incidents).where(gte(incidents.startedAt, now - 14 * DAY)).orderBy(desc(incidents.startedAt)).limit(60).all()
    .filter((i) => !hidden.has(i.checkId)).slice(0, 15)
    .map((i) => ({ id: i.id, serviceName: i.serviceName, startedAt: i.startedAt, endedAt: i.endedAt }));
  return { groups: gs.map((g) => ({ id: g.id, name: g.name })), services: items, incidents: recent, generatedAt: now };
}
