import { ApiError, route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { newId } from "@/server/auth/session";
import { NotificationsInput } from "@/lib/schemas";
import { lastResults, readDestinations, sealUrl, writeDestinations, type Destination } from "@/server/notify/notify";
export const dynamic = "force-dynamic";

const read = () => {
  const last = lastResults();
  return { destinations: readDestinations(getDb()).map((d) => ({ id: d.id, kind: d.kind, urlSet: !!d.urlSealed, enabled: d.enabled, onRecovery: d.onRecovery, last: last[d.id] ?? null })) };
};
export const GET = route({ auth: "admin" }, read);
export const PUT = route({ auth: "admin", body: NotificationsInput }, ({ body }) => {
  const db = getDb();
  const prev = new Map(readDestinations(db).map((d) => [d.id, d]));
  const next: Destination[] = body.destinations.map((d) => {
    const old = d.id ? prev.get(d.id) : undefined;
    const urlSealed = d.url ? sealUrl(d.url) : old?.urlSealed ?? null;
    if (d.enabled && !urlSealed) throw new ApiError(400, "url_required", "Enter a URL to enable a destination");
    return { id: old?.id ?? newId(), kind: d.kind, urlSealed, enabled: d.enabled, onRecovery: d.onRecovery };
  });
  writeDestinations(db, next);
  return read();
});
