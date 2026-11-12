import "server-only";
import { getDb, closeDb, dataDir } from "@/server/db/client";
import { loadMasterKey } from "@/server/crypto/secretbox";
import { startScheduler, stopScheduler } from "@/server/scheduler/scheduler";
import { initSetupCode } from "@/server/auth/setupToken";
import { startDiscovery, stopDiscovery } from "@/server/discovery/runner";

const g = globalThis as unknown as { __homiBooted?: boolean };

/** Runs once per process: key, DB + migrations, scheduler, graceful shutdown. */
export function boot() {
  if (g.__homiBooted) return;
  g.__homiBooted = true;
  loadMasterKey(dataDir());
  const db = getDb();
  const code = initSetupCode(db);
  if (code) console.warn(`[homi] First-run setup code: ${code}  (enter it on /setup; set HOMI_SETUP_TOKEN to choose your own, or HOMI_SETUP_OPEN=1 to disable)`);
  startScheduler();
  startDiscovery();
  const shutdown = () => { stopDiscovery(); stopScheduler(); closeDb(); process.exit(0); };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  console.log("[homi] ready");
}
