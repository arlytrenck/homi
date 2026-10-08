import { route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { services } from "@/server/db/schema";
import { ServiceInput } from "@/lib/schemas";
import { newId } from "@/server/auth/session";
import { changed, nextSort, upsertCheck } from "@/server/data";
export const dynamic = "force-dynamic";
export const POST = route({ auth: "admin", body: ServiceInput }, ({ body }) => {
  const id = newId(), now = Date.now();
  getDb().insert(services).values({ id, groupId: body.groupId ?? null, name: body.name, description: body.description ?? null, url: body.url, icon: body.icon ?? null, sort: nextSort(services), targetBlank: body.targetBlank, tags: body.tags, hiddenPublic: body.hiddenPublic, alertsMuted: body.alertsMuted, createdAt: now, updatedAt: now }).run();
  if (body.check) upsertCheck(id, body.name, body.check);
  changed();
  return { id };
});
