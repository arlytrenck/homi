import { eq } from "drizzle-orm";
import { ApiError, route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { widgets } from "@/server/db/schema";
import { WidgetPatch } from "@/lib/schemas";
import { changed } from "@/server/data";
import { dropWidgetCache } from "@/server/integrations/runtime";

export const dynamic = "force-dynamic";
export const PATCH = route({ auth: "admin", body: WidgetPatch }, ({ body, params }) => {
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) if (v !== undefined) set[k] = v;
  if (!Object.keys(set).length) return;
  if (!getDb().update(widgets).set(set).where(eq(widgets.id, params.id)).run().changes) throw new ApiError(404, "not_found", "Widget not found");
  dropWidgetCache(params.id);
  changed();
});
export const DELETE = route({ auth: "admin" }, ({ params }) => {
  if (!getDb().delete(widgets).where(eq(widgets.id, params.id)).run().changes) throw new ApiError(404, "not_found", "Widget not found");
  dropWidgetCache(params.id);
  changed();
});
