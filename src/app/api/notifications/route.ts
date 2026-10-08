import { ApiError, route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { NotificationsInput } from "@/lib/schemas";
import { lastNotify, readStored, sealUrl, writeStored } from "@/server/notify/notify";
export const dynamic = "force-dynamic";

const read = () => {
  const s = readStored(getDb());
  return { enabled: !!s?.enabled, kind: s?.kind ?? "webhook", urlSet: !!s?.urlSealed, onRecovery: s?.onRecovery ?? true, last: lastNotify() };
};
export const GET = route({ auth: "admin" }, read);
export const PUT = route({ auth: "admin", body: NotificationsInput }, ({ body }) => {
  const db = getDb();
  const prev = readStored(db);
  const urlSealed = body.url ? sealUrl(body.url) : prev?.urlSealed ?? null;
  if (body.enabled && !urlSealed) throw new ApiError(400, "url_required", "Enter a URL to enable notifications");
  writeStored(db, { enabled: body.enabled, kind: body.kind, urlSealed, onRecovery: body.onRecovery });
  return read();
});
