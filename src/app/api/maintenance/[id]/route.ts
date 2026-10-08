import { eq } from "drizzle-orm";
import { ApiError, route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { maintenanceWindows } from "@/server/db/schema";
import { changed } from "@/server/data";
export const dynamic = "force-dynamic";

/** Upcoming windows are removed; a running one ends now, so the "still down" follow-up still fires. */
export const DELETE = route({ auth: "admin" }, ({ params }) => {
  const db = getDb();
  const w = db.select().from(maintenanceWindows).where(eq(maintenanceWindows.id, params.id)).get();
  if (!w) throw new ApiError(404, "not_found", "Maintenance window not found");
  const now = Date.now();
  if (w.startsAt > now) db.delete(maintenanceWindows).where(eq(maintenanceWindows.id, w.id)).run();
  else db.update(maintenanceWindows).set({ endsAt: now }).where(eq(maintenanceWindows.id, w.id)).run();
  changed();
});
