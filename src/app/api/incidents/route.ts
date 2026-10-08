import { and, desc, eq } from "drizzle-orm";
import { route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { checks, incidents, services } from "@/server/db/schema";
export const dynamic = "force-dynamic";

export const GET = route({ auth: "public" }, ({ req, viewer }) => {
  const q = req.nextUrl.searchParams;
  const limit = Math.min(200, Math.max(1, Number(q.get("limit")) || 50));
  const checkId = q.get("checkId");
  const rows = getDb().select({ i: incidents, hidden: services.hiddenPublic }).from(incidents)
    .innerJoin(checks, eq(checks.id, incidents.checkId)).leftJoin(services, eq(services.id, checks.serviceId))
    .where(checkId ? eq(incidents.checkId, checkId) : undefined).orderBy(desc(incidents.startedAt)).limit(limit * 2).all()
    .filter((r) => viewer.kind === "admin" || !r.hidden).slice(0, limit);
  return {
    incidents: rows.map(({ i }) => ({ id: i.id, checkId: i.checkId, serviceName: i.serviceName, startedAt: i.startedAt, endedAt: i.endedAt, affectedBy: i.affectedBy, ...(viewer.kind === "admin" ? { error: i.error } : {}) })),
  };
});
