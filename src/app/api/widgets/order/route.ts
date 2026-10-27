import { eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError, route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { widgets } from "@/server/db/schema";
import { changed } from "@/server/data";

export const dynamic = "force-dynamic";
export const PUT = route({ auth: "admin", body: z.object({ ids: z.array(z.string()).max(500) }) }, ({ body }) => {
  const db = getDb();
  if (new Set(body.ids).size !== body.ids.length) throw new ApiError(400, "duplicate", "Widget listed twice");
  const known = new Set(db.select({ id: widgets.id }).from(widgets).all().map((r) => r.id));
  if (body.ids.some((id) => !known.has(id))) throw new ApiError(400, "unknown_widget", "Order lists a widget that no longer exists");
  db.transaction((tx) => body.ids.forEach((id, i) => tx.update(widgets).set({ sort: i }).where(eq(widgets.id, id)).run()));
  changed();
});
