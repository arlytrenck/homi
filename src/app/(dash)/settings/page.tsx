import { redirect } from "next/navigation";
import { pageViewer } from "@/server/auth/guard";
import { SettingsView } from "@/components/SettingsView";
export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };
export default async function Page() {
  if ((await pageViewer()) !== "admin") redirect("/login");
  return <SettingsView />;
}
