import { sql } from "drizzle-orm";
import { route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";

export const dynamic = "force-dynamic";
export const GET = route({ auth: "none" }, () => ({
  needsSetup: getDb().select({ n: sql<number>`count(*)` }).from(users).get()!.n === 0,
  setupTokenRequired: !!process.env.HOMI_SETUP_TOKEN,
}));
