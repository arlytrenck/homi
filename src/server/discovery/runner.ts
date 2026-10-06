import "server-only";
import { dockerEndpoint, listContainers } from "./docker";
import { syncDiscovered, type SyncResult } from "./sync";
import { changed } from "@/server/data";

export interface DiscoveryStatus {
  enabled: boolean; endpoint: string | null; lastRunAt: number | null; lastOkAt: number | null; lastError: string | null; lastResult: SyncResult | null;
}
const INTERVAL_MS = 30_000;
const g = globalThis as unknown as { __homiDiscovery?: { status: DiscoveryStatus; timer?: NodeJS.Timeout } };

export const discoveryStatus = (): DiscoveryStatus => g.__homiDiscovery?.status ?? { enabled: false, endpoint: null, lastRunAt: null, lastOkAt: null, lastError: null, lastResult: null };

export async function runDiscoveryOnce() {
  const st = g.__homiDiscovery!.status;
  if (!st.endpoint) return;
  st.lastRunAt = Date.now();
  try {
    const containers = await listContainers(st.endpoint);
    const r = syncDiscovered(containers, { host: process.env.HOMI_DISCOVERY_HOST });
    const prev = st.lastResult;
    st.lastResult = r; st.lastOkAt = Date.now(); st.lastError = null;
    if (r.created || r.removed || !prev || prev.missing !== r.missing) changed();
    else if (r.updated) changed();
  } catch (e) {
    st.lastError = (e as any)?.code === "ENOENT" || (e as any)?.code === "EACCES" ? `Cannot open Docker socket (${(e as any).code}). Mount it and check permissions.` : (e as Error).message;
  }
}

export function startDiscovery() {
  if (g.__homiDiscovery) return;
  const endpoint = dockerEndpoint();
  g.__homiDiscovery = { status: { enabled: !!endpoint, endpoint, lastRunAt: null, lastOkAt: null, lastError: null, lastResult: null } };
  if (!endpoint) return;
  void runDiscoveryOnce();
  g.__homiDiscovery.timer = setInterval(() => void runDiscoveryOnce(), INTERVAL_MS);
}
export function stopDiscovery() { if (g.__homiDiscovery?.timer) clearInterval(g.__homiDiscovery.timer); g.__homiDiscovery = undefined; }
