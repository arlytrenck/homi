import { eq } from "drizzle-orm";
import { ApiError, route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { groups } from "@/server/db/schema";
import { GroupInput } from "@/lib/schemas";
import { changed } from "@/server/data";
export const dynamic = "force-dynamic";
export const PATCH = route({ auth: "admin", body: GroupInput.partial() }, ({ body, params }) => {
  const r = getDb().update(groups).set({ ...(body.name !== undefined && { name: body.name }), ...(body.icon !== undefined && { icon: body.icon ?? null }), ...(body.collapsed !== undefined && { collapsed: body.collapsed }) }).where(eq(groups.id, params.id)).run();
  if (!r.changes) throw new ApiError(404, "not_found", "Group not found");
  changed();
});
export const DELETE = route({ auth: "admin" }, ({ params }) => {
  const r = getDb().delete(groups).where(eq(groups.id, params.id)).run();
  if (!r.changes) throw new ApiError(404, "not_found", "Group not found");
  changed();
});
