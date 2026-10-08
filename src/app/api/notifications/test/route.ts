import { ApiError, route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { NotificationsTest } from "@/lib/schemas";
import { decryptSecrets } from "@/server/crypto/secretbox";
import { deliver, readStored } from "@/server/notify/notify";
import { friendlyError } from "@/server/integrations/runtime";
export const dynamic = "force-dynamic";

export const POST = route({ auth: "admin", body: NotificationsTest }, async ({ body }) => {
  const s = readStored(getDb());
  const kind = body.kind ?? s?.kind ?? "webhook";
  const url = body.url ?? (s?.urlSealed ? decryptSecrets<{ url: string }>(s.urlSealed, "notifications:url").url : null);
  if (!url) throw new ApiError(400, "url_required", "Enter a URL first");
  try { await deliver(kind, url, { kind: "down", name: "Homi test", status: "down", previous: "up", error: "This is a test notification", ts: Date.now() }); return { ok: true }; }
  catch (e) { return { ok: false, error: friendlyError(e) }; }
});
