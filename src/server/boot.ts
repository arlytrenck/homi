import "server-only";
import { getDb, closeDb, dataDir } from "@/server/db/client";
import { loadMasterKey } from "@/server/crypto/secretbox";
import { startScheduler, stopScheduler } from "@/server/scheduler/scheduler";
import { startDiscovery, stopDiscovery } from "@/server/discovery/runner";

const g = globalThis as unknown as { __homiBooted?: boolean };

/** Runs once per process: key, DB + migrations, scheduler, graceful shutdown. */
export function boot() {
  if (g.__homiBooted) return;
  g.__homiBooted = true;
  loadMasterKey(dataDir());
  getDb();
  startScheduler();
  startDiscovery();
  const shutdown = () => { stopDiscovery(); stopScheduler(); closeDb(); process.exit(0); };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  console.log("[homi] ready");
}
