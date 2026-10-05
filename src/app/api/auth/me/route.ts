import { route } from "@/server/api";
export const dynamic = "force-dynamic";
export const GET = route({ auth: "none" }, ({ viewer }) => ({ kind: viewer.kind, username: viewer.kind === "admin" ? viewer.user.username : null }));
