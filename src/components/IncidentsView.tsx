"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api-client";
import { useViewer } from "./Providers";

export interface Incident { id: string; checkId: string; serviceName: string; startedAt: number; endedAt: number | null; affectedBy: string | null; error?: string | null }

export function fmtDuration(ms: number) {
  const m = Math.round(ms / 60_000);
  if (m < 1) return "under a minute";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ${m % 60} min` : `${Math.floor(h / 24)} d ${h % 24} h`;
}

export function IncidentsView() {
  const admin = useViewer() === "admin";
  const { data, isError } = useQuery({ queryKey: ["incidents"], queryFn: () => api<{ incidents: Incident[] }>("/api/incidents?limit=100"), refetchInterval: 30_000 });
  const rows = data?.incidents ?? [];
  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <div className="flex items-center gap-3"><Link href="/ops" className="btn" aria-label="Back to ops view"><ArrowLeft size={16} /></Link><h1 className="text-xl font-semibold">Incidents</h1></div>
      <p className="text-sm text-muted">Every outage of a monitored service, newest first. Kept for 90 days.</p>
      {isError && <p role="alert" className="text-down-fg">Couldn’t load incidents.</p>}
      {data && !rows.length && <div className="card p-8 text-center text-muted">No incidents recorded yet.</div>}
      {!!rows.length && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-medium text-muted"><tr><th className="p-2">Service</th><th className="p-2">Started</th><th className="p-2">Duration</th><th className="p-2">{admin ? "Cause" : "Note"}</th></tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="border-t border-border align-top">
                  <td className="p-2 font-medium">{i.serviceName}</td>
                  <td className="p-2 tabular-nums text-muted">{new Date(i.startedAt).toLocaleString()}</td>
                  <td className="p-2 tabular-nums">{i.endedAt ? fmtDuration(i.endedAt - i.startedAt) : <span className="rounded-full bg-down px-2 py-0.5 text-xs font-medium text-white">Ongoing</span>}</td>
                  <td className="p-2 text-muted">{i.affectedBy ? `Affected by ${i.affectedBy}` : admin ? i.error ?? "–" : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
