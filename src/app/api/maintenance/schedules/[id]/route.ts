import { eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError, route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { maintenanceSchedules } from "@/server/db/schema";
import { changed } from "@/server/data";
export const dynamic = "force-dynamic";

export const PATCH = route({ auth: "admin", body: z.object({ enabled: z.boolean() }) }, ({ body, params }) => {
  // Re-enabling must not replay occurrences that passed while it was off.
  const r = getDb().update(maintenanceSchedules).set({ enabled: body.enabled, handledUntil: Date.now() }).where(eq(maintenanceSchedules.id, params.id)).run();
  if (!r.changes) throw new ApiError(404, "not_found", "Schedule not found");
  changed();
});

export const DELETE = route({ auth: "admin" }, ({ params }) => {
  const r = getDb().delete(maintenanceSchedules).where(eq(maintenanceSchedules.id, params.id)).run();
  if (!r.changes) throw new ApiError(404, "not_found", "Schedule not found");
  changed();
});
