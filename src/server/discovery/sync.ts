import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, type Db } from "@/server/db/client";
import { checks, groups, services } from "@/server/db/schema";
import { newId } from "@/server/auth/session";
import { parseContainer, type Discovered, type DockerContainer } from "./labels";

export const MISSING_TTL_MS = 24 * 3600_000;

export interface SyncResult { created: number; updated: number; missing: number; removed: number; skipped: { key: string; reason: string }[] }

function groupId(db: Db, name: string | null): string | null {
  if (!name) return null;
  const ex = db.select().from(groups).all().find((g) => g.name === name);
  if (ex) return ex.id;
  const id = newId();
  const max = db.select().from(groups).all().reduce((m, g) => Math.max(m, g.sort), -1);
  db.insert(groups).values({ id, name, sort: max + 1, createdAt: Date.now() }).run();
  return id;
}

function writeCheck(db: Db, serviceId: string, name: string, d: Discovered["check"], enabled = true) {
  const ex = db.select().from(checks).where(eq(checks.serviceId, serviceId)).get();
  if (!d) { if (ex) db.delete(checks).where(eq(checks.id, ex.id)).run(); return; }
  const vals = { name, type: d.type, target: d.target, enabled };
  if (ex) db.update(checks).set(vals).where(eq(checks.id, ex.id)).run();
  else db.insert(checks).values({ id: newId(), serviceId, ...vals }).run();
}

/**
 * Reconcile discovered containers with docker-sourced services.
 * Label-owned fields (name, url, icon, description, public flag, check) are overwritten each sync;
 * group and sort are only set on creation so users can arrange them in the UI.
 */
export function syncDiscovered(containers: DockerContainer[], opts: { host?: string }, db: Db = getDb(), now = Date.now()): SyncResult {
  const res: SyncResult = { created: 0, updated: 0, missing: 0, removed: 0, skipped: [] };
  const seen = new Set<string>();
  const found: Discovered[] = [];
  for (const c of containers) {
    const p = parseContainer(c, opts);
    if (!p) continue;
    if (!p.ok) { res.skipped.push({ key: p.key, reason: p.reason }); seen.add(p.key); continue; } // keep existing service on a transient label error
    if (seen.has(p.value.key)) continue;
    seen.add(p.value.key); found.push(p.value);
  }

  db.transaction((tx) => {
    const existing = tx.select().from(services).where(eq(services.source, "docker")).all();
    const byRef = new Map(existing.map((s) => [s.sourceRef, s]));
    const maxSort = () => tx.select().from(services).all().reduce((m, s) => Math.max(m, s.sort), -1);

    for (const d of found) {
      const ex = byRef.get(d.key);
      if (!ex) {
        const id = newId();
        tx.insert(services).values({ id, groupId: groupId(tx as unknown as Db, d.group), name: d.name, description: d.description, url: d.url, icon: d.icon, sort: maxSort() + 1, source: "docker", sourceRef: d.key, hiddenPublic: d.hiddenPublic, createdAt: now, updatedAt: now }).run();
        writeCheck(tx as unknown as Db, id, d.name, d.check);
        res.created++;
      } else {
        const wasMissing = ex.missingSince != null;
        tx.update(services).set({ name: d.name, description: d.description, url: d.url, icon: d.icon, hiddenPublic: d.hiddenPublic, missingSince: null, updatedAt: now, ...(wasMissing && !ex.groupId ? { groupId: groupId(tx as unknown as Db, d.group) } : {}) }).where(eq(services.id, ex.id)).run();
        writeCheck(tx as unknown as Db, ex.id, d.name, d.check);
        res.updated++;
      }
    }

    for (const s of existing) {
      if (seen.has(s.sourceRef ?? "")) continue;
      const since = s.missingSince ?? now;
      if (now - since >= MISSING_TTL_MS) { tx.delete(services).where(eq(services.id, s.id)).run(); res.removed++; continue; }
      if (s.missingSince == null) {
        tx.update(services).set({ missingSince: now }).where(eq(services.id, s.id)).run();
        tx.update(checks).set({ enabled: false, lastStatus: "unknown", consecutiveFailures: 0 }).where(eq(checks.serviceId, s.id)).run();
      }
      res.missing++;
    }
  });
  return res;
}

export const isDockerManaged = (db: Db, id: string) => !!db.select().from(services).where(and(eq(services.id, id), eq(services.source, "docker"))).get();
