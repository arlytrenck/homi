import { and, eq, gte, asc } from "drizzle-orm";
import { ApiError, route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { checks, checkResults, checkRollups } from "@/server/db/schema";
export const dynamic = "force-dynamic";
const H = 3600_000;
const RANGES: Record<string, number> = { "24h": 24 * H, "7d": 7 * 24 * H, "30d": 30 * 24 * H, "90d": 90 * 24 * H };

export const GET = route({ auth: "public" }, ({ req, viewer, params }) => {
  const db = getDb();
  const c = db.select().from(checks).where(eq(checks.id, params.id)).get();
  if (!c) throw new ApiError(404, "not_found", "Check not found");
  const range = req.nextUrl.searchParams.get("range") ?? "24h";
  const span = RANGES[range];
  if (!span) throw new ApiError(400, "bad_range", "range must be 24h, 7d, 30d or 90d");
  const since = Date.now() - span;
  const raw = db.select().from(checkResults).where(and(eq(checkResults.checkId, c.id), gte(checkResults.ts, since))).orderBy(asc(checkResults.ts)).all();
  const rolled = range === "24h" ? [] : db.select().from(checkRollups).where(and(eq(checkRollups.checkId, c.id), gte(checkRollups.bucketTs, since))).orderBy(asc(checkRollups.bucketTs)).all();
  const cutoff = rolled.length ? Math.max(...rolled.map((r) => r.bucketTs)) + H : 0;
  let samples = 0, ups = 0;
  const points = [
    ...rolled.map((r) => { samples += r.samples; ups += r.ups; return { ts: r.bucketTs, ok: r.ups / r.samples, latencyMs: r.avgLatency }; }),
    ...raw.filter((r) => r.ts >= cutoff).map((r) => { samples++; if (r.ok) ups++; return { ts: r.ts, ok: r.ok ? 1 : 0, latencyMs: r.latencyMs }; }),
  ];
  return { range, uptime: samples ? ups / samples : null, samples, points, ...(viewer.kind === "admin" ? { errors: raw.filter((r) => r.error).slice(-20).map((r) => ({ ts: r.ts, error: r.error })) } : {}) };
});
