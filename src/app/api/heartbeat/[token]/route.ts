import { ApiError, route } from "@/server/api";
import { recordHeartbeat } from "@/server/checks/heartbeat";
export const dynamic = "force-dynamic";

// The token in the URL is the credential, so there is no session; unknown tokens look like any 404.
const ping = route({ auth: "none" }, ({ params }) => {
  if (!recordHeartbeat(params.token, true)) throw new ApiError(404, "not_found", "Unknown heartbeat");
  return { ok: true };
});
export const GET = ping;
export const POST = ping;
