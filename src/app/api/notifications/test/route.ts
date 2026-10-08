import { ApiError, route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { NotificationsTest } from "@/lib/schemas";
import { deliver, openUrl, readDestinations } from "@/server/notify/notify";
import { friendlyError } from "@/server/integrations/runtime";
export const dynamic = "force-dynamic";

export const POST = route({ auth: "admin", body: NotificationsTest }, async ({ body }) => {
  const saved = body.id ? readDestinations(getDb()).find((d) => d.id === body.id) : undefined;
  const kind = body.kind ?? saved?.kind ?? "webhook";
  const url = body.url ?? (saved?.urlSealed ? openUrl(saved.urlSealed) : null);
  if (!url) throw new ApiError(400, "url_required", "Enter a URL first");
  try { await deliver(kind, url, { kind: "down", name: "Homi test", status: "down", previous: "up", error: "This is a test notification", ts: Date.now() }); return { ok: true }; }
  catch (e) { return { ok: false, error: friendlyError(e) }; }
});
