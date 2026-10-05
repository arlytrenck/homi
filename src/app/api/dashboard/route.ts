import { route, getSetting } from "@/server/api";
import { dashboardData } from "@/server/data";
export const dynamic = "force-dynamic";
export const GET = route({ auth: "public" }, ({ viewer }) => ({
  ...dashboardData({ publicOnly: viewer.kind !== "admin" }),
  settings: { title: getSetting("title", "Homi"), theme: getSetting("theme", "system") },
  viewer: viewer.kind,
}));
