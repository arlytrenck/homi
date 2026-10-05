import { ApiError, route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { widgets } from "@/server/db/schema";
import { WidgetInput } from "@/lib/schemas";
import { widgetRegistry } from "@/plugins/registry";
import { newId } from "@/server/auth/session";
import { changed, nextSort } from "@/server/data";
import { validateFields } from "@/server/integrations/runtime";

export const dynamic = "force-dynamic";
export const POST = route({ auth: "admin", body: WidgetInput }, ({ body }) => {
  const def = widgetRegistry[body.kind];
  if (!def) throw new ApiError(400, "unknown_kind", "Unknown widget type");
  if (def.pluginId && !body.integrationId) throw new ApiError(400, "invalid_body", "Choose an integration for this widget");
  const bad = validateFields(def.options, body.options);
  if (bad) throw new ApiError(400, "invalid_body", bad);
  const id = newId();
  getDb().insert(widgets).values({ id, kind: body.kind, integrationId: def.pluginId ? body.integrationId! : null, title: body.title ?? null, options: body.options, area: body.area, size: body.size, hiddenPublic: body.hiddenPublic, sort: nextSort(widgets) }).run();
  changed();
  return { id };
});
