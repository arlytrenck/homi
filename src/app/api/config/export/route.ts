import { route } from "@/server/api";
import { exportYaml } from "@/server/config/yaml";
export const dynamic = "force-dynamic";
export const GET = route({ auth: "admin" }, () => new Response(exportYaml(), { headers: { "content-type": "text/yaml; charset=utf-8", "content-disposition": 'attachment; filename="homi.yaml"' } }));
