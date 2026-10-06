"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";

interface Status {
  enabled: boolean; endpoint: string | null; lastRunAt: number | null; lastOkAt: number | null; lastError: string | null; discoveryHost: string | null;
  lastResult: { created: number; updated: number; missing: number; removed: number; skipped: { key: string; reason: string }[] } | null;
  services: { id: string; name: string; url: string; container: string | null; missingSince: number | null }[];
}
const ago = (t: number | null) => (t ? `${Math.max(0, Math.round((Date.now() - t) / 1000))}s ago` : "never");

export function DiscoveryPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["discovery"], queryFn: () => api<Status>("/api/discovery"), refetchInterval: 15_000 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!data) return null;
  const refresh = async () => {
    setBusy(true); setErr("");
    try { await api("/api/discovery/refresh", { method: "POST" }); await qc.invalidateQueries({ queryKey: ["discovery"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); }
    catch (x) { setErr(x instanceof ApiClientError ? x.message : "Failed"); }
    setBusy(false);
  };
  return (
    <section className="card space-y-3 p-5" aria-labelledby="h-disc">
      <div className="flex items-center gap-2">
        <h2 id="h-disc" className="font-semibold">Docker discovery</h2>
        {data.enabled && <button className="btn ml-auto !min-h-8" onClick={refresh} disabled={busy}><RefreshCw size={14} className={busy ? "animate-spin" : ""} /> Sync now</button>}
      </div>
      {!data.enabled ? (
        <p className="text-sm text-muted">Off. Mount <code>/var/run/docker.sock</code> (or set <code>HOMI_DOCKER_HOST</code> to a socket-proxy URL), then label containers with <code>homi.enable=true</code>. See docs/docker-labels.md.</p>
      ) : (
        <>
          <p className="text-sm text-muted">Connected to <code>{data.endpoint}</code>. Last sync {ago(data.lastOkAt)}.{!data.discoveryHost && <> Set <code>HOMI_DISCOVERY_HOST</code> to derive URLs from published ports.</>}</p>
          {data.lastError && <p role="alert" className="text-sm text-down-fg">{data.lastError}</p>}
          {data.lastResult?.skipped.map((s) => <p key={s.key} className="text-sm text-warn-fg"><b>{s.key}</b>: {s.reason}</p>)}
          <ul className="divide-y divide-border text-sm">
            {data.services.map((s) => <li key={s.id} className="flex gap-2 py-1.5"><span className="min-w-0 flex-1 truncate">{s.name} <span className="text-muted">({s.container})</span></span>{s.missingSince ? <span className="text-warn-fg">not running</span> : <span className="text-ok-fg">running</span>}</li>)}
            {!data.services.length && <li className="py-1.5 text-muted">No labeled containers found yet.</li>}
          </ul>
        </>
      )}
      {err && <p role="alert" className="text-sm text-down-fg">{err}</p>}
    </section>
  );
}
