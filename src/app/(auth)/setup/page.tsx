import { redirect } from "next/navigation";
import { needsSetup } from "@/server/auth/guard";
import { AuthForm } from "../AuthForm";
export const dynamic = "force-dynamic";
export const metadata = { title: "Setup" };
export default function Page() {
  if (!needsSetup()) redirect("/login");
  return <AuthForm mode="setup" tokenRequired={!!process.env.HOMI_SETUP_TOKEN} />;
}
