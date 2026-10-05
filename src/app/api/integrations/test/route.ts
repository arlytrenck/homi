import { eq } from "drizzle-orm";
import { route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { integrations } from "@/server/db/schema";
import { IntegrationTestInput } from "@/lib/schemas";
import { openSecrets, testIntegration } from "@/server/integrations/runtime";
import { mergeSecrets } from "@/server/integrations/store";

export const dynamic = "force-dynamic";
export const POST = route({ auth: "admin", body: IntegrationTestInput }, async ({ body }) => {
  // When testing a saved integration, unset form fields fall back to stored secrets.
  let secrets = mergeSecrets({}, body.secrets);
  if (body.integrationId) {
    const row = getDb().select().from(integrations).where(eq(integrations.id, body.integrationId)).get();
    if (row) { try { secrets = mergeSecrets(openSecrets(row), body.secrets); } catch { /* ignore */ } }
  }
  return testIntegration(body.type, { baseUrl: body.baseUrl, config: body.config, secrets, ignoreTls: body.ignoreTls });
});
