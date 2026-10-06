import { eq } from "drizzle-orm";
import { ApiError, route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { services, checks } from "@/server/db/schema";
import { ServicePatch } from "@/lib/schemas";
import { changed, upsertCheck } from "@/server/data";
import { isDockerManaged } from "@/server/discovery/sync";
export const dynamic = "force-dynamic";
export const PATCH = route({ auth: "admin", body: ServicePatch }, ({ body, params }) => {
  const db = getDb();
  if (isDockerManaged(db, params.id)) {
    const owned = Object.keys(body).filter((k) => k !== "groupId");
    if (owned.length) throw new ApiError(409, "managed_by_docker", "This service is managed by Docker labels. Change the container's homi.* labels instead; only its group can be edited here.");
  }
  const { check, ...rest } = body;
  const set: Record<string, unknown> = { updatedAt: Date.now() };
  for (const [k, v] of Object.entries(rest)) if (v !== undefined) set[k] = v;
  const r = db.update(services).set(set).where(eq(services.id, params.id)).run();
  if (!r.changes) throw new ApiError(404, "not_found", "Service not found");
  const s = db.select().from(services).where(eq(services.id, params.id)).get()!;
  if (check) upsertCheck(s.id, s.name, check);
  else if (check === null) db.delete(checks).where(eq(checks.serviceId, s.id)).run();
  changed();
});
export const DELETE = route({ auth: "admin" }, ({ params }) => {
  if (isDockerManaged(getDb(), params.id)) throw new ApiError(409, "managed_by_docker", "This service is managed by Docker labels. Remove the homi.enable label (or the container) to remove it.");
  const r = getDb().delete(services).where(eq(services.id, params.id)).run();
  if (!r.changes) throw new ApiError(404, "not_found", "Service not found");
  changed();
});
