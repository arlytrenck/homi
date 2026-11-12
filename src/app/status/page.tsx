import { notFound } from "next/navigation";
import { getSetting } from "@/server/api";
import { needsSetup } from "@/server/auth/guard";
import { StatusPage } from "@/components/StatusPage";
export const dynamic = "force-dynamic";
export const metadata = { title: "Status" };

export default function Page() {
  if (needsSetup() || !getSetting("statusPage", false)) notFound();
  return <StatusPage />;
}
