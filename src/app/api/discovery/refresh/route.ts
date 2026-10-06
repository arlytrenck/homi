import { ApiError, route } from "@/server/api";
import { discoveryStatus, runDiscoveryOnce } from "@/server/discovery/runner";

export const dynamic = "force-dynamic";
export const POST = route({ auth: "admin" }, async () => {
  if (!discoveryStatus().enabled) throw new ApiError(400, "disabled", "Docker discovery is not enabled (no Docker socket or HOMI_DOCKER_HOST)");
  await runDiscoveryOnce();
  return discoveryStatus();
});
