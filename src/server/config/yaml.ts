import "server-only";
import YAML from "yaml";
import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { groups, services, checks } from "@/server/db/schema";
import { CheckInput, ServiceInput } from "@/lib/schemas";
import { newId } from "@/server/auth/session";
import { nextSort, upsertCheck } from "@/server/data";

const YService = ServiceInput.omit({ groupId: true });
const YDoc = z.object({
  version: z.literal(1),
  groups: z.array(z.object({ name: z.string().min(1).max(100), icon: z.string().nullish(), services: z.array(YService).default([]) })).default([]),
  ungrouped: z.array(YService).default([]),
});
export type YamlDoc = z.infer<typeof YDoc>;

const checkOut = (c: typeof checks.$inferSelect | undefined) =>
  c ? { type: c.type, target: c.target, intervalS: c.intervalS, timeoutMs: c.timeoutMs, expectedStatus: c.expectedStatus, keyword: c.keyword ?? undefined, ignoreTls: c.ignoreTls, enabled: c.enabled } : undefined;

export function exportYaml(): string {
  const db = getDb();
  const cs = new Map(db.select().from(checks).all().map((c) => [c.serviceId, c]));
  const svcs = db.select().from(services).orderBy(asc(services.sort)).all();
  const toY = (s: typeof services.$inferSelect) => ({ name: s.name, url: s.url, description: s.description ?? undefined, icon: s.icon ?? undefined, targetBlank: s.targetBlank, tags: s.tags, hiddenPublic: s.hiddenPublic, check: checkOut(cs.get(s.id)) });
  const doc = {
    version: 1,
    groups: db.select().from(groups).orderBy(asc(groups.sort)).all().map((g) => ({ name: g.name, icon: g.icon ?? undefined, services: svcs.filter((s) => s.groupId === g.id).map(toY) })),
    ungrouped: svcs.filter((s) => !s.groupId).map(toY),
  };
  return YAML.stringify(doc);
}

export interface ImportResult { groupsCreated: number; servicesCreated: number; servicesUpdated: number; dryRun: boolean }

export function importYaml(text: string, opts: { mode: "merge" | "replace"; dryRun: boolean }): ImportResult {
  const doc = YDoc.parse(YAML.parse(text));
  const db = getDb();
  const res: ImportResult = { groupsCreated: 0, servicesCreated: 0, servicesUpdated: 0, dryRun: opts.dryRun };
  const apply = (tx: typeof db) => {
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
        tx.insert(services).values({ id, groupId, name: y.name, description: y.description ?? null, url: y.url, icon: y.icon ?? null, sort: nextSort(services), targetBlank: y.targetBlank, tags: y.tags, hiddenPublic: y.hiddenPublic, createdAt: now, updatedAt: now }).run();
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
