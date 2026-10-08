import "server-only";
import YAML from "yaml";
import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { getDb, type Db } from "@/server/db/client";
import { groups, services, checks, maintenanceSchedules } from "@/server/db/schema";
import { CheckInput, ServiceInput, QuietInput, destUrl } from "@/lib/schemas";
import { validTimeZone } from "@/server/notify/quiet";
import { describeRecurrence } from "@/server/schedule";
import { openUrl, readDestinations, sealUrl, writeDestinations, UNGROUPED, type Destination } from "@/server/notify/notify";
import { newId } from "@/server/auth/session";
import { nextSort, upsertCheck } from "@/server/data";

const YService = ServiceInput.omit({ groupId: true });
/** Alert destinations are exported without their URL: it is a secret (webhook token, ntfy topic). */
const YDest = z.object({
  kind: z.enum(["webhook", "ntfy"]),
  url: destUrl.optional(),
  enabled: z.boolean().default(true),
  onRecovery: z.boolean().default(true),
  groups: z.array(z.string()).default([]),
  ungrouped: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(32)).max(20).default([]),
  quiet: QuietInput.optional(),
});
const YSchedule = z.object({
  name: z.string().trim().max(100).optional(),
  scope: z.enum(["all", "group", "service"]),
  /** group or service name */
  target: z.string().optional(),
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMin: z.number().int().min(1).max(48 * 60),
  tz: z.string().max(64),
  enabled: z.boolean().default(true),
});
const YDoc = z.object({
  version: z.literal(1),
  alerts: z.object({ destinations: z.array(YDest).max(5).default([]) }).optional(),
  maintenance: z.object({ schedules: z.array(YSchedule).default([]) }).optional(),
  groups: z.array(z.object({ name: z.string().min(1).max(100), icon: z.string().nullish(), services: z.array(YService).default([]) })).default([]),
  ungrouped: z.array(YService).default([]),
});
export type YamlDoc = z.infer<typeof YDoc>;
const none = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => !(Array.isArray(v) && !v.length) && v !== false && v !== undefined));

const checkOut = (c: typeof checks.$inferSelect | undefined) =>
  c ? { type: c.type, target: c.target, intervalS: c.intervalS, timeoutMs: c.timeoutMs, ...(c.httpMethod !== "GET" && { httpMethod: c.httpMethod as "HEAD" }), expectedStatus: c.expectedStatus, keyword: c.keyword ?? undefined, ignoreTls: c.ignoreTls, enabled: c.enabled } : undefined;

export function exportYaml(): string {
  const db = getDb();
  const cs = new Map(db.select().from(checks).all().map((c) => [c.serviceId, c]));
  const svcs = db.select().from(services).where(eq(services.source, "manual")).orderBy(asc(services.sort)).all(); // docker-managed services come from labels, not backups
  const toY = (s: typeof services.$inferSelect) => ({ name: s.name, url: s.url, description: s.description ?? undefined, icon: s.icon ?? undefined, targetBlank: s.targetBlank, tags: s.tags, hiddenPublic: s.hiddenPublic, ...(s.alertsMuted && { alertsMuted: true }), check: checkOut(cs.get(s.id)) });
  const doc = {
    version: 1,
    groups: db.select().from(groups).orderBy(asc(groups.sort)).all().map((g) => ({ name: g.name, icon: g.icon ?? undefined, services: svcs.filter((s) => s.groupId === g.id).map(toY) })),
    ungrouped: svcs.filter((s) => !s.groupId).map(toY),
  };
  const gname = new Map(db.select().from(groups).all().map((g) => [g.id, g.name]));
  const sname = new Map(db.select().from(services).all().map((x) => [x.id, x.name]));
  const destinations = readDestinations(db).map((d) => ({
    kind: d.kind, enabled: d.enabled, onRecovery: d.onRecovery,
    ...none({ groups: (d.groupIds ?? []).filter((id) => id !== UNGROUPED).map((id) => gname.get(id)).filter(Boolean), ungrouped: (d.groupIds ?? []).includes(UNGROUPED), tags: d.tags ?? [] }),
    ...(d.quiet && { quiet: d.quiet }),
  }));
  const schedules = db.select().from(maintenanceSchedules).all().map((s) => ({
    name: s.name, scope: s.kind,
    ...(s.kind === "group" ? { target: gname.get(s.targetId ?? "") } : s.kind === "service" ? { target: sname.get(s.targetId ?? "") } : {}),
    days: s.days, startTime: s.startTime, durationMin: s.durationMin, tz: s.tz, enabled: s.enabled,
  })).filter((s) => s.scope === "all" || s.target);
  return YAML.stringify({ ...doc, ...(destinations.length && { alerts: { destinations } }), ...(schedules.length && { maintenance: { schedules } }) });
}

export interface ImportResult { groupsCreated: number; servicesCreated: number; servicesUpdated: number; schedulesCreated: number; schedulesUpdated: number; destinationsAdded: number; skipped: string[]; dryRun: boolean }

export function importYaml(text: string, opts: { mode: "merge" | "replace"; dryRun: boolean }): ImportResult {
  const doc = YDoc.parse(YAML.parse(text));
  const db = getDb();
  const res: ImportResult = { groupsCreated: 0, servicesCreated: 0, servicesUpdated: 0, schedulesCreated: 0, schedulesUpdated: 0, destinationsAdded: 0, skipped: [], dryRun: opts.dryRun };
  const apply = (tx: typeof db) => {
    const oldG = new Map(tx.select().from(groups).all().map((g) => [g.id, g.name]));
    const oldS = new Map(tx.select().from(services).all().map((x) => [x.id, x.name]));
    if (opts.mode === "replace") { tx.delete(services).run(); tx.delete(groups).run(); }
    const existingGroups = new Map(tx.select().from(groups).all().map((g) => [g.name, g.id]));
    const placeService = (y: z.infer<typeof YService>, groupId: string | null) => {
      const ex = tx.select().from(services).where(eq(services.name, y.name)).all().find((s) => s.groupId === groupId);
      const { check, ...rest } = y;
      if (ex) {
        tx.update(services).set({ ...rest, description: rest.description ?? null, icon: rest.icon ?? null, updatedAt: Date.now() }).where(eq(services.id, ex.id)).run();
        if (check) upsertCheck(ex.id, y.name, CheckInput.parse(check));
        res.servicesUpdated++;
      } else {
        const id = newId(), now = Date.now();
        tx.insert(services).values({ id, groupId, name: y.name, description: y.description ?? null, url: y.url, icon: y.icon ?? null, sort: nextSort(services), targetBlank: y.targetBlank, tags: y.tags, hiddenPublic: y.hiddenPublic, alertsMuted: y.alertsMuted, createdAt: now, updatedAt: now }).run();
        if (check) upsertCheck(id, y.name, CheckInput.parse(check));
        res.servicesCreated++;
      }
    };
    for (const g of doc.groups) {
      let gid = existingGroups.get(g.name);
      if (!gid) { gid = newId(); tx.insert(groups).values({ id: gid, name: g.name, icon: g.icon ?? null, sort: nextSort(groups), createdAt: Date.now() }).run(); existingGroups.set(g.name, gid); res.groupsCreated++; }
      g.services.forEach((s) => placeService(s, gid!));
    }
    doc.ungrouped.forEach((s) => placeService(s, null));

    // "Replace" recreates every group and service with new ids: re-point whatever the file does not itself redefine.
    if (opts.mode === "replace") {
      const newSvc = new Map(tx.select().from(services).all().map((x) => [x.name, x.id]));
      if (!doc.maintenance) {
        for (const sc of tx.select().from(maintenanceSchedules).all()) {
          if (sc.kind === "all") continue;
          const name = (sc.kind === "group" ? oldG : oldS).get(sc.targetId ?? "");
          const id = name ? (sc.kind === "group" ? existingGroups.get(name) : newSvc.get(name)) : undefined;
          if (id) tx.update(maintenanceSchedules).set({ targetId: id }).where(eq(maintenanceSchedules.id, sc.id)).run();
          else { tx.update(maintenanceSchedules).set({ enabled: false }).where(eq(maintenanceSchedules.id, sc.id)).run(); res.skipped.push(`Maintenance “${sc.name}” targets something not in the file and was paused`); }
        }
      }
      if (!doc.alerts) {
        writeDestinations(tx as unknown as Db, readDestinations(tx as unknown as Db).map((d) => {
          if (!d.groupIds?.length) return d;
          const ids = d.groupIds.map((g) => (g === UNGROUPED ? g : oldG.get(g) ? existingGroups.get(oldG.get(g)!) : undefined));
          const kept = ids.filter((g): g is string => !!g);
          if (kept.length === ids.length) return { ...d, groupIds: kept };
          res.skipped.push(`Alert destination (${d.kind}) was scoped to a group that is not in the file${kept.length ? "; its scope was narrowed" : " and was switched off"}`);
          return { ...d, groupIds: kept, enabled: kept.length ? d.enabled : false };
        }));
      }
    }

    // Maintenance schedules: target by name; "replace" only touches sections the file actually contains.
    if (doc.maintenance) {
      if (opts.mode === "replace") tx.delete(maintenanceSchedules).run();
      for (const y of doc.maintenance.schedules) {
        const targetId = y.scope === "all" ? null : y.scope === "group" ? existingGroups.get(y.target ?? "") ?? null : tx.select().from(services).where(eq(services.name, y.target ?? "")).get()?.id ?? null;
        const label = y.name ?? `${y.scope} ${y.target ?? ""}`;
        if (y.scope !== "all" && !targetId) { res.skipped.push(`Maintenance “${label}”: ${y.scope} “${y.target ?? ""}” not found`); continue; }
        if (!validTimeZone(y.tz)) { res.skipped.push(`Maintenance “${label}”: unknown time zone “${y.tz}”`); continue; }
        const days = [...new Set(y.days)].sort((a, b) => a - b);
        const name = y.name || `${describeRecurrence({ days, startTime: y.startTime, durationMin: y.durationMin, tz: y.tz })}: ${y.target ?? "Everything"}`;
        const vals = { name, kind: y.scope, targetId, days, startTime: y.startTime, durationMin: y.durationMin, tz: y.tz, enabled: y.enabled };
        const ex = tx.select().from(maintenanceSchedules).where(eq(maintenanceSchedules.name, name)).get();
        if (ex) { tx.update(maintenanceSchedules).set(vals).where(eq(maintenanceSchedules.id, ex.id)).run(); res.schedulesUpdated++; }
        else { const now = Date.now(); tx.insert(maintenanceSchedules).values({ id: newId(), ...vals, handledUntil: now, createdAt: now }).run(); res.schedulesCreated++; }
      }
    }

    // Alert destinations: URLs are never exported, so these arrive switched off until a URL is entered.
    if (doc.alerts) {
      const list: Destination[] = opts.mode === "replace" ? [] : readDestinations(tx as unknown as Db);
      const shape = (d: { kind: string; groupIds?: string[]; tags?: string[]; quiet?: unknown }) => JSON.stringify([d.kind, [...(d.groupIds ?? [])].sort(), (d.tags ?? []).map((t) => t.toLowerCase()).sort(), d.quiet ?? null]);
      for (const y of doc.alerts.destinations) {
        const ids = y.groups.map((n) => existingGroups.get(n));
        const missing = y.groups.filter((_, i) => !ids[i]);
        if (missing.length) { res.skipped.push(`Alert destination (${y.kind}): group “${missing[0]}” not found, so it was not imported`); continue; }
        const groupIds = [...ids as string[], ...(y.ungrouped ? [UNGROUPED] : [])];
        const dest = { kind: y.kind, groupIds, tags: y.tags, quiet: y.quiet };
        const dup = list.some((d) => d.kind === y.kind && (y.url ? d.urlSealed && openUrl(d.urlSealed) === y.url : shape(d) === shape(dest)));
        if (dup) continue;
        if (list.length >= 5) { res.skipped.push(`Alert destination (${y.kind}): the limit of 5 is reached`); continue; }
        list.push({ id: newId(), kind: y.kind, urlSealed: y.url ? sealUrl(y.url) : null, enabled: y.url ? y.enabled : false, onRecovery: y.onRecovery, groupIds, tags: y.tags, ...(y.quiet && { quiet: y.quiet }) });
        res.destinationsAdded++;
      }
      writeDestinations(tx as unknown as Db, list);
    }
  };
  try {
    db.transaction((tx) => {
      apply(tx as unknown as typeof db);
      if (opts.dryRun) tx.rollback();
    });
  } catch (e) {
    if (!(opts.dryRun && e instanceof Error && e.message === "Rollback")) throw e;
  }
  return res;
}
