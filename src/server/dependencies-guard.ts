import "server-only";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { ApiError } from "@/server/api";
import { services } from "@/server/db/schema";
import { wouldCycle } from "./dependencies";

/** Throws a 400/404 ApiError unless `parentId` (when given) is another existing service and does not close a loop. */
export function assertValidUpstream(db: Db, serviceId: string | null, parentId: string | null | undefined) {
  if (!parentId) return;
  if (!db.select({ id: services.id }).from(services).where(eq(services.id, parentId)).get()) throw new ApiError(404, "not_found", "Upstream service not found");
  if (serviceId && wouldCycle(db, serviceId, parentId)) throw new ApiError(400, "dependency_cycle", "That would make the service depend on itself");
}
