import { route, getSetting } from "@/server/api";
import { getDb } from "@/server/db/client";
import { settings } from "@/server/db/schema";
import { SettingsInput } from "@/lib/schemas";
import { changed } from "@/server/data";
export const dynamic = "force-dynamic";
const read = () => ({
  title: getSetting("title", "Homi"), theme: getSetting("theme", "system"), publicView: getSetting("publicView", false),
  allowLoopback: getSetting("allowLoopback", false), retentionHours: getSetting("retentionHours", 48), weather: getSetting("weather", null),
});
export const GET = route({ auth: "admin" }, read);
export const PATCH = route({ auth: "admin", body: SettingsInput }, ({ body }) => {
  const db = getDb();
  for (const [key, value] of Object.entries(body)) if (value !== undefined) db.insert(settings).values({ key, value: value as any }).onConflictDoUpdate({ target: settings.key, set: { value: value as any } }).run();
  changed();
  return read();
});
