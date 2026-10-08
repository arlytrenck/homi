"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wrench, X } from "lucide-react";
import { api } from "@/lib/api-client";
import type { ServiceDTO } from "@/lib/types";
import { StatusDot } from "./StatusDot";
import { useViewer } from "./Providers";

const RANGES = ["24h", "7d", "30d", "90d"] as const;
type Range = (typeof RANGES)[number];
type Hist = { range: Range; uptime: number | null; samples: number; points: { ts: number; ok: number; latencyMs: number | null }[]; errors?: { ts: number; error: string }[] };

const W = 560, H = 140, PAD = 4;

function Chart({ points, range }: { points: Hist["points"]; range: Range }) {
  const g = useMemo(() => {
    const span = { "24h": 24, "7d": 168, "30d": 720, "90d": 2160 }[range] * 3600_000;
    const end = Date.now(), start = end - span;
    const lat = points.filter((p) => p.latencyMs != null);
    const max = Math.max(50, ...lat.map((p) => p.latencyMs!)) * 1.1;
    const x = (t: number) => PAD + ((t - start) / span) * (W - 2 * PAD);
    const y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
    const path = lat.map((p, i) => `${i ? "L" : "M"}${x(p.ts).toFixed(1)},${y(p.latencyMs!).toFixed(1)}`).join("");
    const w = Math.max(2, (W - 2 * PAD) / Math.min(points.length || 1, 200));
    const bad = points.filter((p) => p.ok < 0.999).map((p) => ({ x: x(p.ts) - w / 2, full: p.ok === 0 }));
    return { path, bad, w, max };
  }, [points, range]);
  if (!points.length) return <p className="grid h-[140px] place-items-center text-sm text-muted">No data yet</p>;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full" role="img" aria-label={`Latency over ${range}, peak ${Math.round(g.max / 1.1)} ms`}>
      {g.bad.map((b, i) => <rect key={i} x={b.x} y={0} width={g.w} height={H} className={b.full ? "fill-down" : "fill-warn"} opacity={0.25} />)}
      <path d={g.path} fill="none" strokeWidth={1.5} className="stroke-accent" strokeLinejoin="round" />
    </svg>
  );
}

export function ServiceDetail({ service, onClose }: { service: ServiceDTO; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [range, setRange] = useState<Range>("24h");
  const st = service.status!;
  const qc = useQueryClient();
  const admin = useViewer() === "admin";
  const [pauseNote, setPauseNote] = useState("");
  const pause = async (minutes: number) => { try { await api("/api/maintenance", { method: "POST", body: { kind: "service", targetId: service.id, minutes } }); qc.invalidateQueries({ queryKey: ["dashboard"] }); setPauseNote("Alerts held"); } catch { setPauseNote("Failed"); } };
  useEffect(() => { ref.current?.showModal(); }, []);
  const { data, isLoading } = useQuery({ queryKey: ["hist-detail", st.id, range], queryFn: () => api<Hist>(`/api/checks/${st.id}/history?range=${range}`), refetchInterval: 60_000 });
  const stats = useMemo(() => {
    const l = (data?.points ?? []).map((p) => p.latencyMs).filter((v): v is number => v != null);
    return l.length ? { avg: Math.round(l.reduce((a, b) => a + b, 0) / l.length), min: Math.round(Math.min(...l)), max: Math.round(Math.max(...l)) } : null;
  }, [data]);
  const since = st.changedAt ? new Date(st.changedAt).toLocaleString() : null;
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }} aria-labelledby="sd-title" className="m-auto w-[min(38rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-0 text-fg backdrop:bg-black/50 max-sm:mb-0 max-sm:rounded-b-none">
      <div className="space-y-4 p-5">
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="sd-title" className="truncate text-lg font-semibold">{service.name}</h2>
            <p className="flex items-center gap-1.5 text-sm capitalize text-muted"><StatusDot status={st.status} /> {st.status}{since && <span className="normal-case"> since {since}</span>}</p>
          </div>
          <button className="btn !min-h-8 !px-2" onClick={() => ref.current?.close()} aria-label="Close"><X size={16} /></button>
        </header>
        <div className="flex gap-1" role="tablist" aria-label="Time range">
          {RANGES.map((r) => <button key={r} role="tab" aria-selected={r === range} className={`btn !min-h-8 !px-3 text-xs ${r === range ? "btn-primary" : ""}`} onClick={() => setRange(r)}>{r}</button>)}
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Uptime", data?.uptime != null ? `${(data.uptime * 100).toFixed(data.uptime === 1 ? 0 : 2)}%` : "–"], ["Avg latency", stats ? `${stats.avg} ms` : "–"], ["Best / worst", stats ? `${stats.min} / ${stats.max} ms` : "–"], ["Checks", data ? String(data.samples) : "–"]].map(([k, v]) => (
            <div key={k}><dd className="text-lg font-medium tabular-nums">{v}</dd><dt className="text-xs text-muted">{k}</dt></div>
          ))}
        </dl>
        {isLoading ? <div className="h-36 animate-pulse rounded bg-surface-2" aria-label="Loading" /> : <Chart points={data?.points ?? []} range={range} />}
        {!!data?.errors?.length && (
          <div>
            <h3 className="mb-1 text-xs font-medium text-muted">Recent errors</h3>
            <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs">{[...data.errors].reverse().map((e, i) => <li key={i} className="flex gap-2"><span className="shrink-0 tabular-nums text-muted">{new Date(e.ts).toLocaleString()}</span><span className="truncate">{e.error}</span></li>)}</ul>
          </div>
        )}
        {admin && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-sm">
            <span className="flex items-center gap-1.5 text-muted"><Wrench size={14} aria-hidden /> Hold alerts for</span>
            {[["1 h", 60], ["4 h", 240], ["1 day", 1440]].map(([l, m]) => <button key={l} className="btn !min-h-8 !px-3 text-xs" onClick={() => pause(m as number)} disabled={service.maintenance}>{l}</button>)}
            <span className="text-xs text-muted" role="status">{service.maintenance ? "In maintenance (manage in Settings)" : pauseNote}</span>
          </div>
        )}
        <p className="truncate text-xs text-muted">{st.type ? `${st.type.toUpperCase()} · ${st.target}` : service.url}</p>
      </div>
    </dialog>
  );
}
