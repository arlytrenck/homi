import { route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { groups } from "@/server/db/schema";
import { GroupInput } from "@/lib/schemas";
import { newId } from "@/server/auth/session";
import { changed, nextSort } from "@/server/data";
export const dynamic = "force-dynamic";
export const POST = route({ auth: "admin", body: GroupInput }, ({ body }) => {
  const id = newId();
  getDb().insert(groups).values({ id, name: body.name, icon: body.icon ?? null, sort: nextSort(groups), createdAt: Date.now() }).run();
  changed();
  return { id };
});
