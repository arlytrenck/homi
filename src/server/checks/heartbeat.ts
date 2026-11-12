import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { checks } from "@/server/db/schema";
import { getScheduler } from "@/server/scheduler/scheduler";

/** Records a push from a cron job / backup script. Returns false for an unknown token or a disabled check. */
export function recordHeartbeat(token: string, ok: boolean, message?: string | null): boolean {
  const db = getDb();
  const c = db.select().from(checks).where(eq(checks.token, token)).get();
  if (!c || c.type !== "heartbeat" || !c.enabled) return false;
  const now = Date.now();
  db.update(checks).set({ lastPingAt: now }).where(eq(checks.id, c.id)).run(); // even a failure report is a sign of life; overdue is judged from the last report
  getScheduler()?.record(c.id, ok ? { ok: true, latencyMs: null } : { ok: false, latencyMs: null, error: (message || "job reported failure").slice(0, 200), immediate: true }, now);
  return true;
}
