import { ApiError, route, getSetting } from "@/server/api";
import { getDb } from "@/server/db/client";
import { statusPageData } from "@/server/statusPage";
export const dynamic = "force-dynamic";

/** Public by design: only exists while the admin has switched the status page on. Hidden services never appear. */
export const GET = route({ auth: "none" }, () => {
  if (!getSetting("statusPage", false)) throw new ApiError(404, "not_found", "Status page is not enabled");
  return { title: getSetting("title", "Homi"), ...statusPageData(getDb()) };
});
