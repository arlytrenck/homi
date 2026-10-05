import { route } from "@/server/api";
import { CheckInput } from "@/lib/schemas";
import { runCheck } from "@/server/checks/runner";
export const dynamic = "force-dynamic";
export const POST = route({ auth: "admin", body: CheckInput }, ({ body }) => runCheck({ type: body.type, target: body.target, timeoutMs: body.timeoutMs, expectedStatus: body.expectedStatus, keyword: body.keyword, ignoreTls: body.ignoreTls }));
