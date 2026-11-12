"use client";
import { useState } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { BrandMark } from "./BrandMark";
import { StatusDot } from "./StatusDot";
import { fmtDuration } from "./IncidentsView";
import { banner } from "@/lib/status";

import type { StatusItem } from "@/lib/status";
interface Day { day: number; ratio: number | null }
type Item = StatusItem & { id: string; name: string; groupId: string | null; days: Day[]; uptime: number | null }
interface Data { title: string; groups: { id: string; name: string }[]; services: Item[]; incidents: { id: string; serviceName: string; startedAt: number; endedAt: number | null }[]; generatedAt: number }

const pct = (r: number | null) => (r == null ? "No data" : `${(r * 100).toFixed(r >= 0.9995 ? 0 : 2)}%`);

function Bars({ days, name }: { days: Day[]; name: string }) {
  return (
    <div className="flex h-7 items-end gap-px" role="img" aria-label={`${name}: 90-day uptime history`}>
      {days.map((d) => (
        <span key={d.day} title={`${new Date(d.day).toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" })}: ${pct(d.ratio)}`}
          className={`min-w-0 flex-1 rounded-[1px] ${d.ratio == null ? "bg-surface-2" : d.ratio >= 0.999 ? "bg-ok" : d.ratio >= 0.95 ? "bg-warn" : "bg-down"}`} style={{ height: d.ratio == null || d.ratio >= 0.999 ? "70%" : "100%" }} />
      ))}
    </div>
  );
}

function Page() {
  const { data, isError } = useQuery({ queryKey: ["status"], queryFn: () => api<Data>("/api/status"), refetchInterval: 30_000 });
  if (!data) return <div className="grid min-h-dvh place-items-center text-muted" role="status">{isError ? "Status is unavailable." : "Loading…"}</div>;
  const b = banner(data.services);
  const sections = [...data.groups.map((g) => ({ id: g.id, name: g.name })), { id: "", name: "Other" }]
    .map((g) => ({ ...g, items: data.services.filter((s) => (s.groupId ?? "") === g.id) })).filter((g) => g.items.length);
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-6 flex items-center gap-3"><BrandMark size={32} /><h1 className="text-xl font-semibold tracking-tight">{data.title} status</h1></header>
      <div role="status" className={`mb-8 flex items-center gap-2.5 rounded-xl border p-4 font-medium ${b.tone === "ok" ? "border-ok/40 bg-ok/10" : b.tone === "warn" ? "border-warn/50 bg-warn/10" : "border-down/50 bg-down/10"}`}><StatusDot status={b.tone === "ok" ? "up" : b.tone === "warn" ? "degraded" : "down"} />{b.text}</div>
      {!sections.length && <p className="text-center text-muted">No monitored services are published here yet.</p>}
      {sections.map((g) => (
        <section key={g.id || "other"} aria-labelledby={`st-${g.id || "other"}`} className="mb-8">
          <h2 id={`st-${g.id || "other"}`} className="mb-2 text-sm font-semibold text-muted">{g.name}</h2>
          <ul className="card divide-y divide-border p-0">
            {g.items.map((s) => (
              <li key={s.id} className="space-y-1.5 p-3">
                <div className="flex items-center gap-2">
                  <StatusDot status={s.status} />
                  <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                  {s.maintenance && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-warn-fg">Maintenance</span>}
                  <span className="text-sm tabular-nums text-muted">{pct(s.uptime)}</span>
                </div>
                <Bars days={s.days} name={s.name} />
              </li>
            ))}
          </ul>
          <p className="mt-1 flex justify-between text-xs text-muted"><span>90 days ago</span><span>Today</span></p>
        </section>
      ))}
      <section aria-labelledby="st-inc">
        <h2 id="st-inc" className="mb-2 text-sm font-semibold text-muted">Past incidents (14 days)</h2>
        {data.incidents.length ? (
          <ul className="card divide-y divide-border p-0 text-sm">
            {data.incidents.map((i) => <li key={i.id} className="flex flex-wrap gap-x-3 p-3"><span className="font-medium">{i.serviceName}</span><span className="tabular-nums text-muted">{new Date(i.startedAt).toLocaleString()}</span><span className="ml-auto">{i.endedAt ? `Resolved after ${fmtDuration(i.endedAt - i.startedAt)}` : <b className="text-down-fg">Ongoing</b>}</span></li>)}
          </ul>
        ) : <p className="card p-4 text-sm text-muted">No incidents in the last 14 days.</p>}
      </section>
      <p className="mt-8 text-center text-xs text-muted">Updated {new Date(data.generatedAt).toLocaleTimeString()} · refreshes automatically</p>
    </main>
  );
}

export function StatusPage() {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));
  return <QueryClientProvider client={qc}><Page /></QueryClientProvider>;
}
