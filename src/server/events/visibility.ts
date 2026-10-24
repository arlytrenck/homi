import "server-only";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { checks, services } from "@/server/db/schema";
import type { HomiEvent } from "./hub";

/** Public viewers must not learn the state of services hidden from the public view. */
export function visibleToPublic(db: Db, e: HomiEvent): boolean {
  if (e.type === "hoststats") return false;
  if (e.type !== "status") return true;
  const row = db.select({ hidden: services.hiddenPublic }).from(checks).innerJoin(services, eq(services.id, checks.serviceId)).where(eq(checks.id, e.checkId)).get();
  return !!row && !row.hidden;
}
