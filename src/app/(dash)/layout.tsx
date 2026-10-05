import { redirect } from "next/navigation";
import { needsSetup, pageViewer } from "@/server/auth/guard";
import { Providers } from "@/components/Providers";
export const dynamic = "force-dynamic";
export default async function DashLayout({ children }: { children: React.ReactNode }) {
  if (needsSetup()) redirect("/setup");
  const v = await pageViewer();
  if (v === "anon") redirect("/login");
  return <Providers viewer={v}>{children}</Providers>;
}
