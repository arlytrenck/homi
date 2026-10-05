import { ApiError, route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { integrations } from "@/server/db/schema";
import { IntegrationInput } from "@/lib/schemas";
import { getPlugin } from "@/plugins/registry";
import { validateFields } from "@/server/integrations/runtime";
import { createIntegration, toDto } from "@/server/integrations/store";
import { changed } from "@/server/data";

export const dynamic = "force-dynamic";
export const GET = route({ auth: "admin" }, () => ({ integrations: getDb().select().from(integrations).all().map(toDto) }));
export const POST = route({ auth: "admin", body: IntegrationInput }, ({ body }) => {
  const p = getPlugin(body.type);
  if (!p) throw new ApiError(400, "unknown_type", "Unknown integration type");
  const bad = validateFields({ ...p.config, ...p.secrets }, { ...body.config, ...body.secrets });
  if (bad) throw new ApiError(400, "invalid_body", bad);
  const id = createIntegration(body);
  changed();
  return { id };
});
