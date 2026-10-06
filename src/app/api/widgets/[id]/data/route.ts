import { eq } from "drizzle-orm";
import { ApiError, route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { widgets } from "@/server/db/schema";
import { getWidgetData } from "@/server/integrations/runtime";

export const dynamic = "force-dynamic";
export const GET = route({ auth: "public" }, async ({ req, viewer, params }) => {
  const w = getDb().select().from(widgets).where(eq(widgets.id, params.id)).get();
  if (!w || (viewer.kind !== "admin" && w.hiddenPublic)) throw new ApiError(404, "not_found", "Widget not found");
  const e = await getWidgetData(params.id, viewer.kind === "admin" && req.nextUrl.searchParams.get("refresh") === "1");
  // Public viewers get data only, never error details (they can leak internal hostnames).
  return viewer.kind === "admin" ? e : { data: e.data, ts: e.ts, error: e.error ? "Unavailable" : undefined };
});
