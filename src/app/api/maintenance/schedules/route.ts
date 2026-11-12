import { eq } from "drizzle-orm";
import { ApiError, route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { groups, maintenanceSchedules, services } from "@/server/db/schema";
import { MaintenanceScheduleInput } from "@/lib/schemas";
import { newId } from "@/server/auth/session";
import { changed } from "@/server/data";
import { describeRecurrence } from "@/server/schedule";
export const dynamic = "force-dynamic";

export const POST = route({ auth: "admin", body: MaintenanceScheduleInput }, ({ body }) => {
  const db = getDb();
  let target = "Everything";
  if (body.kind === "service") { const s = db.select().from(services).where(eq(services.id, body.targetId!)).get(); if (!s) throw new ApiError(404, "not_found", "Service not found"); target = s.name; }
  if (body.kind === "group") { const g = db.select().from(groups).where(eq(groups.id, body.targetId!)).get(); if (!g) throw new ApiError(404, "not_found", "Group not found"); target = g.name; }
  const id = newId(), now = Date.now();
  const days = [...new Set(body.days)].sort((a, b) => a - b);
  db.insert(maintenanceSchedules).values({ id, name: body.name || `${describeRecurrence({ ...body, days })}: ${target}`, kind: body.kind, targetId: body.kind === "all" ? null : body.targetId!, days, startTime: body.startTime, durationMin: body.durationMin, tz: body.tz, handledUntil: now, createdAt: now }).run();
  changed();
  return { id };
});
