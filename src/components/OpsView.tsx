"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api-client";
import type { DashboardDTO, Status } from "@/lib/types";
import { StatusDot } from "./StatusDot";

const ORDER: Record<Status, number> = { down: 0, degraded: 1, unknown: 2, up: 3 };
const SEG = 48, SPAN = 24 * 3600_000;

type Hist = { points: { ts: number; ok: number }[]; uptime: number | null };

function Bar({ checkId }: { checkId: string }) {
  const { data } = useQuery({ queryKey: ["hist", checkId], queryFn: () => api<Hist>(`/api/checks/${checkId}/history?range=24h`), refetchInterval: 60_000 });
  const segs = useMemo(() => {
    const now = Date.now(), w = SPAN / SEG;
    const b: { n: number; ok: number }[] = Array.from({ length: SEG }, () => ({ n: 0, ok: 0 }));
    for (const p of data?.points ?? []) { const i = Math.floor((p.ts - (now - SPAN)) / w); if (i >= 0 && i < SEG) { b[i].n++; b[i].ok += p.ok; } }
    return b;
  }, [data]);
  return (
    <div className="flex h-5 items-end gap-px" role="img" aria-label={`24h uptime ${data?.uptime != null ? (data.uptime * 100).toFixed(1) + "%" : "no data"}`}>
      {segs.map((s, i) => <span key={i} className={`w-1 flex-1 rounded-[1px] ${s.n === 0 ? "bg-surface-2" : s.ok / s.n >= 0.999 ? "bg-ok" : s.ok / s.n > 0 ? "bg-warn" : "bg-down"}`} style={{ height: s.n && s.ok / s.n < 0.999 ? "100%" : "70%" }} />)}
    </div>
  );
}

export function OpsView({ kiosk }: { kiosk: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<DashboardDTO>("/api/dashboard") });
  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onmessage = () => qc.invalidateQueries({ queryKey: ["dashboard"] });
    let lock: { release(): Promise<void> } | undefined;
    if (kiosk) (navigator as any).wakeLock?.request("screen").then((l: typeof lock) => (lock = l)).catch(() => {});
    return () => { es.close(); lock?.release(); };
  }, [qc, kiosk]);
  if (!data) return <div className="grid min-h-dvh place-items-center text-muted" role="status">Loading…</div>;
  const rows = data.services.filter((s) => s.status).sort((a, b) => ORDER[a.status!.status] - ORDER[b.status!.status] || a.name.localeCompare(b.name));
  const counts = rows.reduce((m, s) => ({ ...m, [s.status!.status]: (m[s.status!.status] ?? 0) + 1 }), {} as Record<string, number>);
  return (
    <div data-density="dense" className="mx-auto max-w-7xl px-4 py-3">
      {!kiosk && <Link href="/" className="btn mb-3 !min-h-8"><ArrowLeft size={14} /> Dashboard</Link>}
      <div className="mb-3 flex flex-wrap gap-4 text-sm" role="status">
        {(["down", "degraded", "up", "unknown"] as Status[]).map((s) => <span key={s} className="flex items-center gap-1.5"><StatusDot status={s} /> {counts[s] ?? 0} {s}</span>)}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted"><tr><th className="p-2">Service</th><th className="p-2">Status</th><th className="p-2 text-right">Latency</th><th className="p-2 min-w-48">Last 24h</th><th className="p-2 max-md:hidden">Since</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="p-2 font-medium">{s.name}</td>
                <td className="p-2"><span className="flex items-center gap-1.5"><StatusDot status={s.status!.status} /> {s.status!.status}</span></td>
                <td className="p-2 text-right tabular-nums">{s.status!.latencyMs != null ? `${s.status!.latencyMs} ms` : "–"}</td>
                <td className="p-2"><Bar checkId={s.status!.id} /></td>
                <td className="p-2 text-xs text-muted max-md:hidden">{s.status!.changedAt ? new Date(s.status!.changedAt).toLocaleString() : "–"}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="p-6 text-center text-muted">No monitored services yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
