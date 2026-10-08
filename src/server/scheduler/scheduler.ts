import "server-only";
import { eq, lt, sql } from "drizzle-orm";
import { getDb, type Db } from "@/server/db/client";
import { checks, checkResults, checkRollups, services } from "@/server/db/schema";
import { runCheck, type CheckOutcome } from "@/server/checks/runner";
import { publish } from "@/server/events/hub";
import { getSetting } from "@/server/settings";
import { classify, digestTick, notifyTransition } from "@/server/notify/notify";
import { activeWindows, inMaintenance, maintenanceTick } from "@/server/maintenance";

type Check = typeof checks.$inferSelect;
const HOUR = 3600_000;
const MAX_CONCURRENCY = 16;

export type Status = "up" | "down" | "degraded" | "unknown";

/** `down` only after 2 consecutive failures; first failure keeps previous status. */
export function nextStatus(prev: Status, failures: number, o: CheckOutcome): { status: Status; failures: number } {
  if (o.ok) return { status: o.degraded ? "degraded" : "up", failures: 0 };
  const f = failures + 1;
  if (o.immediate) return { status: "down", failures: f };
  return { status: f >= 2 || prev === "unknown" ? "down" : prev, failures: f };
}

export class Scheduler {
  private timer?: NodeJS.Timeout;
  private next = new Map<string, number>();
  private running = new Set<string>();
  private active = 0;
  private buffer: { checkId: string; ts: number; o: CheckOutcome }[] = [];
  private flushTimer?: NodeJS.Timeout;
  private lastMaint = 0;
  private lastDigest = 0;
  private stopped = false;

  constructor(private db: Db = getDb(), private run: typeof runCheck = runCheck) {}

  start() {
    this.stopped = false;
    this.tick();
    this.flushTimer = setInterval(() => this.flush(), 2000);
  }

  /** Config changed: forget deleted checks, and optionally re-run one immediately. Other schedules are kept. */
  reload(runSoonId?: string) {
    if (runSoonId) { this.next.set(runSoonId, 0); return; }
    const ids = new Set(this.db.select({ id: checks.id }).from(checks).all().map((c) => c.id));
    for (const id of this.next.keys()) if (!ids.has(id)) this.next.delete(id);
  }

  private tick = () => {
    if (this.stopped) return;
    const now = Date.now();
    try { this.dispatch(now); } catch (e) { console.error("[homi] scheduler tick failed", e); }
    this.timer = setTimeout(this.tick, 1000);
  };

  private dispatch(now: number) {
    const all = this.db.select().from(checks).where(eq(checks.enabled, true)).all();
    for (const c of all) {
      if (!this.next.has(c.id)) {
        let h = 0;
        for (const ch of c.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        this.next.set(c.id, now + (h % Math.min(c.intervalS * 1000, 5000)));
      }
      if (c.type === "heartbeat") {
        if ((this.next.get(c.id) ?? 0) <= now) { this.next.set(c.id, now + Math.min(c.intervalS, 30) * 1000); this.checkHeartbeat(c, now); }
        continue;
      }
      if ((this.next.get(c.id) ?? 0) <= now && !this.running.has(c.id) && this.active < MAX_CONCURRENCY) void this.exec(c);
    }
    if (now - this.lastDigest > 30_000) { this.lastDigest = now; void digestTick(this.db, now).catch((e) => console.error("[homi] digest failed", e)); void maintenanceTick(this.db, now).catch((e) => console.error("[homi] maintenance follow-up failed", e)); }
    if (now - this.lastMaint > 10 * 60_000) { this.lastMaint = now; this.maintenance(now); }
  }

  /** Push check: overdue = no ping within the interval plus 25%. Waits for the first ping before judging. */
  private checkHeartbeat(c: Check, now: number) {
    if (c.lastPingAt == null || now - c.lastPingAt <= c.intervalS * 1250) return;
    this.record(c.id, { ok: false, latencyMs: null, error: "no heartbeat received", immediate: true }, now);
  }

  private async exec(c: Check) {
    this.running.add(c.id); this.active++;
    this.next.set(c.id, Date.now() + c.intervalS * 1000);
    try {
      const o = await this.run({ type: c.type, target: c.target, timeoutMs: c.timeoutMs, httpMethod: c.httpMethod, expectedStatus: c.expectedStatus, keyword: c.keyword, ignoreTls: c.ignoreTls });
      this.record(c.id, o);
    } catch (e) {
      console.error(`[homi] check ${c.id} failed`, e);
    } finally { this.running.delete(c.id); this.active--; }
  }

  record(checkId: string, o: CheckOutcome, now = Date.now()) {
    const c = this.db.select().from(checks).where(eq(checks.id, checkId)).get();
    if (!c) return;
    const n = nextStatus(c.lastStatus, c.consecutiveFailures, o);
    const changed = n.status !== c.lastStatus;
    this.db.update(checks).set({
      lastStatus: n.status, consecutiveFailures: n.failures, lastLatencyMs: o.latencyMs, lastCheckedAt: now,
      ...(changed ? { lastChangeAt: now } : {}),
    }).where(eq(checks.id, checkId)).run();
    const kind = classify(c.lastStatus, n.status);
    const svc = kind && c.serviceId ? this.db.select({ muted: services.alertsMuted, groupId: services.groupId, tags: services.tags }).from(services).where(eq(services.id, c.serviceId)).get() : undefined;
    const paused = kind && svc && inMaintenance(activeWindows(this.db, now), { id: c.serviceId!, groupId: svc.groupId });
    if (kind && !svc?.muted && !paused) void notifyTransition(this.db, { kind, groupId: svc?.groupId, tags: svc?.tags, name: c.name, status: n.status, previous: c.lastStatus, target: c.target, error: o.error, downForMs: kind === "recovered" && c.lastChangeAt ? now - c.lastChangeAt : undefined, ts: now });
    this.buffer.push({ checkId, ts: now, o });
    publish({ type: "status", checkId, status: n.status, latencyMs: o.latencyMs, ts: now });
  }

  flush() {
    if (!this.buffer.length) return;
    const rows = this.buffer.splice(0);
    this.db.transaction((tx) => {
      for (const r of rows) tx.insert(checkResults).values({ checkId: r.checkId, ts: r.ts, ok: r.o.ok, latencyMs: r.o.latencyMs, code: r.o.code ?? null, error: r.o.error ?? null }).run();
    });
  }

  /** Roll raw results into hourly buckets, then prune raw rows past retention. */
  maintenance(now = Date.now()) {
    this.flush();
    const retentionMs = getSetting("retentionHours", 48) * HOUR;
    const cutoff = now - retentionMs;
    const HR = sql.raw(String(HOUR)); // literal: a bound param would make SQLite divide as floats
    this.db.run(sql`INSERT INTO check_rollups (check_id, bucket_ts, samples, ups, avg_latency)
      SELECT check_id, (ts / ${HR}) * ${HR}, count(*), sum(ok), avg(latency_ms) FROM check_results
      WHERE ts < ${Math.floor(now / HOUR) * HOUR}
      GROUP BY check_id, ts / ${HR}
      ON CONFLICT(check_id, bucket_ts) DO UPDATE SET samples = excluded.samples, ups = excluded.ups, avg_latency = excluded.avg_latency`);
    this.db.delete(checkResults).where(lt(checkResults.ts, cutoff)).run();
    this.db.delete(checkRollups).where(lt(checkRollups.bucketTs, now - 90 * 24 * HOUR)).run();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer); clearInterval(this.flushTimer);
    this.flush();
  }
}

const g = globalThis as unknown as { __homiScheduler?: Scheduler };
export const getScheduler = () => g.__homiScheduler;
export function startScheduler() { if (!g.__homiScheduler) { g.__homiScheduler = new Scheduler(); g.__homiScheduler.start(); } return g.__homiScheduler; }
export function stopScheduler() { g.__homiScheduler?.stop(); g.__homiScheduler = undefined; }
