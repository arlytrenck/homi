import { redirect } from "next/navigation";
import { needsSetup, pageViewer } from "@/server/auth/guard";
import { AuthForm } from "../AuthForm";
export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };
export default async function Page() {
  if (needsSetup()) redirect("/setup");
  if ((await pageViewer()) === "admin") redirect("/");
  return <AuthForm mode="login" />;
}
