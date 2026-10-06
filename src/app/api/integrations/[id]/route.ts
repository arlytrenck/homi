import { eq } from "drizzle-orm";
import { ApiError, route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { integrations } from "@/server/db/schema";
import { IntegrationPatch } from "@/lib/schemas";
import { updateIntegration } from "@/server/integrations/store";
import { changed } from "@/server/data";

export const dynamic = "force-dynamic";
export const PATCH = route({ auth: "admin", body: IntegrationPatch }, ({ body, params }) => {
  if (!updateIntegration(params.id, body)) throw new ApiError(404, "not_found", "Integration not found");
  changed();
});
export const DELETE = route({ auth: "admin" }, ({ params }) => {
  if (!getDb().delete(integrations).where(eq(integrations.id, params.id)).run().changes) throw new ApiError(404, "not_found", "Integration not found");
  changed();
});
