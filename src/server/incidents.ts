import "server-only";
import { and, eq, isNull, lt } from "drizzle-orm";
import { ulid } from "ulid";
import type { Db } from "@/server/db/client";
import { incidents } from "@/server/db/schema";

export const INCIDENT_RETENTION_MS = 90 * 24 * 3600_000;

export function openIncident(db: Db, checkId: string, serviceName: string, now: number, error?: string | null, affectedBy?: string | null) {
  if (db.select({ id: incidents.id }).from(incidents).where(and(eq(incidents.checkId, checkId), isNull(incidents.endedAt))).get()) return; // already open
  db.insert(incidents).values({ id: ulid(), checkId, serviceName, startedAt: now, error: error?.slice(0, 300) ?? null, affectedBy: affectedBy ?? null }).run();
}

export function closeIncident(db: Db, checkId: string, now: number) {
  db.update(incidents).set({ endedAt: now }).where(and(eq(incidents.checkId, checkId), isNull(incidents.endedAt))).run();
}

export const pruneIncidents = (db: Db, now = Date.now()) => { db.delete(incidents).where(lt(incidents.startedAt, now - INCIDENT_RETENTION_MS)).run(); };
