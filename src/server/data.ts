import "server-only";
import { eq, asc, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { groups, services, checks, widgets, integrations } from "@/server/db/schema";
import { newId } from "@/server/auth/session";
import { widgetRegistry } from "@/plugins/registry";
import { publish } from "@/server/events/hub";
import { getScheduler } from "@/server/scheduler/scheduler";
import type { ServiceInput } from "@/lib/schemas";

export const changed = () => { getScheduler()?.reload(); publish({ type: "config-changed" }); };

export function defaultCheck(url: string): NonNullable<ServiceInput["check"]> {
  return { type: "http", httpMethod: "GET", target: url, intervalS: 60, timeoutMs: 5000, expectedStatus: "200-399", ignoreTls: false, enabled: true };
}

export function upsertCheck(serviceId: string, name: string, c: NonNullable<ServiceInput["check"]>) {
  const db = getDb();
  const vals = { name, type: c.type, target: c.target, intervalS: c.intervalS, timeoutMs: c.timeoutMs, httpMethod: c.httpMethod, expectedStatus: c.expectedStatus, keyword: c.keyword ?? null, ignoreTls: c.ignoreTls, enabled: c.enabled };
  const ex = db.select().from(checks).where(eq(checks.serviceId, serviceId)).get();
  let id = ex?.id;
  if (ex) db.update(checks).set(vals).where(eq(checks.id, ex.id)).run();
  else { id = newId(); db.insert(checks).values({ id, serviceId, ...vals }).run(); }
  getScheduler()?.reload(id); // pick up the new settings right away
}

export function nextSort(table: typeof groups | typeof services | typeof widgets): number {
  return (getDb().select({ m: sql<number>`coalesce(max(sort), -1)` }).from(table).get()!.m) + 1;
}

export function dashboardData(opts: { publicOnly: boolean }) {
  const db = getDb();
  const gs = db.select().from(groups).orderBy(asc(groups.sort)).all();
  let ss = db.select().from(services).orderBy(asc(services.sort)).all();
  if (opts.publicOnly) ss = ss.filter((s) => !s.hiddenPublic);
  const cs = db.select().from(checks).all();
  const byService = new Map(cs.map((c) => [c.serviceId, c]));
  const ws = db.select().from(widgets).orderBy(asc(widgets.sort)).all().filter((w) => !opts.publicOnly || !w.hiddenPublic);
  const ints = new Map(db.select({ id: integrations.id, name: integrations.name }).from(integrations).all().map((i) => [i.id, i.name]));
  return {
    widgets: ws.map((w) => ({ id: w.id, kind: w.kind, kindTitle: widgetRegistry[w.kind]?.title ?? w.kind, title: w.title, size: w.size, area: w.area, hiddenPublic: w.hiddenPublic, integrationId: w.integrationId, integrationName: w.integrationId ? ints.get(w.integrationId) ?? null : null, ...(opts.publicOnly ? {} : { options: w.options }) })),
    groups: gs.map((g) => ({ id: g.id, name: g.name, icon: g.icon, collapsed: g.collapsed })),
    services: ss.map((s) => {
      const c = byService.get(s.id);
      return {
        id: s.id, groupId: s.groupId, name: s.name, description: s.description, url: s.url, icon: s.icon, targetBlank: s.targetBlank, tags: s.tags, hiddenPublic: s.hiddenPublic, ...(opts.publicOnly ? {} : { alertsMuted: s.alertsMuted }), source: s.source, missing: s.missingSince != null,
        status: c ? { id: c.id, status: c.lastStatus, latencyMs: c.lastLatencyMs, checkedAt: c.lastCheckedAt, changedAt: c.lastChangeAt, enabled: c.enabled, ...(opts.publicOnly ? {} : { type: c.type, target: c.target, intervalS: c.intervalS, timeoutMs: c.timeoutMs, httpMethod: c.httpMethod, expectedStatus: c.expectedStatus, keyword: c.keyword, ignoreTls: c.ignoreTls }) } : null,
      };
    }),
  };
}
