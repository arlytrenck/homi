import { ApiError, route } from "@/server/api";
import { recordHeartbeat } from "@/server/checks/heartbeat";
export const dynamic = "force-dynamic";

const fail = route({ auth: "none" }, ({ params, req }) => {
  if (!recordHeartbeat(params.token, false, req.nextUrl.searchParams.get("msg"))) throw new ApiError(404, "not_found", "Unknown heartbeat");
  return { ok: true };
});
export const GET = fail;
export const POST = fail;
