import { eq } from "drizzle-orm";
import { ApiError, route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { groups, services } from "@/server/db/schema";
import { LayoutInput } from "@/lib/schemas";
import { changed } from "@/server/data";
export const dynamic = "force-dynamic";
export const PUT = route({ auth: "admin", body: LayoutInput }, ({ body }) => {
  const db = getDb();
  const seen = new Set<string>();
  for (const g of body.groups) for (const id of g.serviceIds) { if (seen.has(id)) throw new ApiError(400, "duplicate", "Service listed twice"); seen.add(id); }
  db.transaction((tx) => {
    body.groupOrder?.forEach((id, i) => tx.update(groups).set({ sort: i }).where(eq(groups.id, id)).run());
    let n = 0;
    for (const g of body.groups) for (const id of g.serviceIds) tx.update(services).set({ groupId: g.id, sort: n++ }).where(eq(services.id, id)).run();
  });
  changed();
});
