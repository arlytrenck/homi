import { OpsView } from "@/components/OpsView";
export const dynamic = "force-dynamic";
export const metadata = { title: "Ops" };
export default async function Page({ searchParams }: { searchParams: Promise<{ kiosk?: string }> }) {
  return <OpsView kiosk={(await searchParams).kiosk === "1"} />;
}
