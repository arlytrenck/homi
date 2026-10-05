import { route } from "@/server/api";
import { plugins } from "@/plugins/registry";
import { coreWidgets } from "@/plugins/core";

export const dynamic = "force-dynamic";
const w = (x: { id: string; title: string; options?: unknown; sizes?: unknown }) => ({ id: x.id, title: x.title, options: x.options ?? {} });
export const GET = route({ auth: "admin" }, () => ({
  core: coreWidgets.map(w),
  integrations: plugins.map((p) => ({ id: p.id, name: p.name, icon: p.icon, description: p.description, baseUrlPlaceholder: p.baseUrlPlaceholder, config: p.config ?? {}, secrets: p.secrets, widgets: p.widgets.map(w) })),
}));
