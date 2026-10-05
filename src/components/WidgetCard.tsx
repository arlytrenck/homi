"use client";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Trash2, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api-client";
import type { WidgetData, WidgetDTO } from "@/lib/types";

const TONE = { ok: "text-ok", warn: "text-warn", down: "text-down", neutral: "" } as const;
const TONE_BG = { ok: "bg-ok", warn: "bg-warn", down: "bg-down", neutral: "bg-unknown" } as const;

export function WidgetCard({ w, edit, onEdit, onDelete }: { w: WidgetDTO; edit: boolean; onEdit: () => void; onDelete: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ["widget", w.id, w.options], queryFn: () => api<WidgetData>(`/api/widgets/${w.id}/data`), refetchInterval: 30_000, staleTime: 10_000 });
  const d = data?.data;
  const title = w.title || w.integrationName || w.kind;
  return (
    <section aria-label={title} className={`card flex flex-col gap-2 p-3 ${w.size === "lg" ? "sm:col-span-2" : ""}`}>
      <header className="flex items-center gap-2 text-xs text-muted">
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {data?.error && <span title={data.error} className="flex items-center gap-1 text-warn"><TriangleAlert size={12} aria-hidden />{d ? "stale" : "error"}</span>}
        {edit && <><button className="btn !min-h-7 !px-2" onClick={onEdit} aria-label={`Edit ${title}`}><Pencil size={12} /></button><button className="btn btn-danger !min-h-7 !px-2" onClick={onDelete} aria-label={`Delete ${title}`}><Trash2 size={12} /></button></>}
      </header>
      {isLoading && <div className="h-10 animate-pulse rounded bg-surface-2" aria-label="Loading" />}
      {!d && data?.error && <p className="text-sm text-down" role="alert">{data.error}</p>}
      {d?.stats && <dl className="grid gap-x-4 gap-y-1" style={{ gridTemplateColumns: `repeat(${Math.min(d.stats.length, 3)}, minmax(0,1fr))` }}>
        {d.stats.map((s) => <div key={s.label} className="min-w-0"><dd className={`truncate text-lg font-medium leading-tight tabular-nums ${TONE[s.tone ?? "neutral"]}`}>{s.value}</dd><dt className="truncate text-xs text-muted">{s.label}{s.hint ? ` · ${s.hint}` : ""}</dt></div>)}
      </dl>}
      {d?.meters?.map((m) => (
        <div key={m.label}>
          <div className="flex justify-between text-xs"><span className="text-muted">{m.label}</span><span className="tabular-nums">{m.text}</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2" role="meter" aria-label={m.label} aria-valuenow={Math.round(m.value * 100)} aria-valuemin={0} aria-valuemax={100}><div className={`h-full ${m.value > 0.9 ? "bg-down" : m.value > 0.75 ? "bg-warn" : "bg-accent"}`} style={{ width: `${m.value * 100}%` }} /></div>
        </div>
      ))}
      {!!d?.rows?.length && <ul className="space-y-1 text-sm">
        {d.rows.map((r, i) => {
          const inner = <><span className={`h-2 w-2 shrink-0 rounded-full ${TONE_BG[r.tone ?? "neutral"]}`} aria-hidden /><span className="min-w-0 flex-1 truncate">{r.primary}</span>{r.secondary && <span className="shrink-0 text-xs text-muted">{r.secondary}</span>}</>;
          return <li key={i}>{r.href ? <a href={r.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline">{inner}</a> : <div className="flex items-center gap-2">{inner}</div>}</li>;
        })}
      </ul>}
      {d?.note && <p className="whitespace-pre-wrap break-words text-xs text-muted">{d.note}</p>}
    </section>
  );
}
