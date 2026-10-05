import { z } from "zod";
import { ApiError, route } from "@/server/api";
import { importYaml } from "@/server/config/yaml";
import { changed } from "@/server/data";
export const dynamic = "force-dynamic";
const Body = z.object({ yaml: z.string().max(2_000_000), mode: z.enum(["merge", "replace"]).default("merge"), dryRun: z.boolean().default(true) });
export const POST = route({ auth: "admin", body: Body }, ({ body }) => {
  try {
    const result = importYaml(body.yaml, { mode: body.mode, dryRun: body.dryRun });
    if (!body.dryRun) changed();
    return result;
  } catch (e) { throw new ApiError(400, "invalid_yaml", e instanceof Error ? e.message : "Invalid YAML"); }
});
