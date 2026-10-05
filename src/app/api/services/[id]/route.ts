import { eq } from "drizzle-orm";
import { ApiError, route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { services, checks } from "@/server/db/schema";
import { ServiceInput } from "@/lib/schemas";
import { changed, upsertCheck } from "@/server/data";
export const dynamic = "force-dynamic";
const Patch = ServiceInput.partial().extend({ check: ServiceInput.shape.check });
export const PATCH = route({ auth: "admin", body: Patch }, ({ body, params }) => {
  const db = getDb();
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
  const r = getDb().delete(services).where(eq(services.id, params.id)).run();
  if (!r.changes) throw new ApiError(404, "not_found", "Service not found");
  changed();
});
