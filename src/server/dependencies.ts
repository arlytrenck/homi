import "server-only";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { checks, services } from "@/server/db/schema";

const MAX_DEPTH = 20;

/** Nearest upstream service whose check is confirmed down, or null. Cycle-safe. */
export function downAncestor(db: Db, serviceId: string): { id: string; name: string } | null {
  const seen = new Set<string>([serviceId]);
  let cur = db.select({ parent: services.dependsOnId }).from(services).where(eq(services.id, serviceId)).get()?.parent ?? null;
  for (let i = 0; cur && i < MAX_DEPTH && !seen.has(cur); i++) {
    seen.add(cur);
    const row = db.select({ name: services.name, parent: services.dependsOnId, status: checks.lastStatus }).from(services).leftJoin(checks, eq(checks.serviceId, services.id)).where(eq(services.id, cur)).get();
    if (!row) return null;
    if (row.status === "down") return { id: cur, name: row.name };
    cur = row.parent;
  }
  return null;
}

/** Every service that (transitively) depends on `serviceId`. */
export function descendants(db: Db, serviceId: string): string[] {
  const all = db.select({ id: services.id, parent: services.dependsOnId }).from(services).all();
  const kids = new Map<string, string[]>();
  for (const s of all) if (s.parent) kids.set(s.parent, [...(kids.get(s.parent) ?? []), s.id]);
  const out: string[] = [], seen = new Set<string>([serviceId]);
  for (const queue = [serviceId]; queue.length;) for (const k of kids.get(queue.shift()!) ?? []) if (!seen.has(k)) { seen.add(k); out.push(k); queue.push(k); }
  return out;
}

/** Would making `parentId` the upstream of `serviceId` create a loop? */
export function wouldCycle(db: Db, serviceId: string, parentId: string): boolean {
  return parentId === serviceId || descendants(db, serviceId).includes(parentId);
}
