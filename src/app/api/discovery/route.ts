import { eq } from "drizzle-orm";
import { route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { services } from "@/server/db/schema";
import { discoveryStatus } from "@/server/discovery/runner";

export const dynamic = "force-dynamic";
export const GET = route({ auth: "admin" }, () => ({
  ...discoveryStatus(),
  discoveryHost: process.env.HOMI_DISCOVERY_HOST ?? null,
  services: getDb().select().from(services).where(eq(services.source, "docker")).all().map((s) => ({ id: s.id, name: s.name, url: s.url, container: s.sourceRef, missingSince: s.missingSince })),
}));
