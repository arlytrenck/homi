import { desc, eq } from "drizzle-orm";
import { ApiError, route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { groups, maintenanceWindows, services } from "@/server/db/schema";
import { MaintenanceInput } from "@/lib/schemas";
import { newId } from "@/server/auth/session";
import { changed } from "@/server/data";
export const dynamic = "force-dynamic";

export const GET = route({ auth: "admin" }, () => {
  const db = getDb();
  const names = new Map([...db.select().from(groups).all().map((g) => [g.id, g.name] as const), ...db.select().from(services).all().map((s) => [s.id, s.name] as const)]);
  const now = Date.now();
  return { windows: db.select().from(maintenanceWindows).orderBy(desc(maintenanceWindows.startsAt)).all().filter((w) => w.endsAt > now).map((w) => ({ id: w.id, name: w.name, kind: w.kind, targetId: w.targetId, targetName: w.kind === "all" ? "Everything" : names.get(w.targetId ?? "") ?? "(deleted)", startsAt: w.startsAt, endsAt: w.endsAt, active: w.startsAt <= now })) };
});

export const POST = route({ auth: "admin", body: MaintenanceInput }, ({ body }) => {
  const db = getDb();
  let target = "Everything";
  if (body.kind === "service") { const s = db.select().from(services).where(eq(services.id, body.targetId!)).get(); if (!s) throw new ApiError(404, "not_found", "Service not found"); target = s.name; }
  if (body.kind === "group") { const g = db.select().from(groups).where(eq(groups.id, body.targetId!)).get(); if (!g) throw new ApiError(404, "not_found", "Group not found"); target = g.name; }
  const now = Date.now();
  const startsAt = body.startsAt ?? now;
  const endsAt = body.endsAt ?? startsAt + body.minutes! * 60_000;
  if (endsAt <= startsAt) throw new ApiError(400, "bad_range", "The end must be after the start");
  if (endsAt <= now) throw new ApiError(400, "bad_range", "That window is already over");
  const id = newId();
  db.insert(maintenanceWindows).values({ id, name: body.name || `Maintenance: ${target}`, kind: body.kind, targetId: body.kind === "all" ? null : body.targetId!, startsAt, endsAt, createdAt: now }).run();
  changed();
  return { id };
});
