"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Wrench } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import type { DashboardDTO } from "@/lib/types";

interface W { id: string; name: string; kind: string; targetName: string; startsAt: number; endsAt: number; active: boolean }
const DURATIONS: [string, number][] = [["30 minutes", 30], ["1 hour", 60], ["4 hours", 240], ["12 hours", 720], ["1 day", 1440], ["1 week", 10080]];
const fmt = (t: number) => new Date(t).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
const localInput = (t: number) => { const d = new Date(t - new Date(t).getTimezoneOffset() * 60_000); return d.toISOString().slice(0, 16); };
const msg = (x: unknown) => (x instanceof ApiClientError ? `${x.message}${x.fields ? " – " + Object.values(x.fields).flat().join(", ") : ""}` : "Failed");

export function MaintenancePanel() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["maintenance"], queryFn: () => api<{ windows: W[] }>("/api/maintenance") });
  const { data: dash } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<DashboardDTO>("/api/dashboard") });
  const [kind, setKind] = useState<"all" | "group" | "service">("all");
  const [note, setNote] = useState("");
  const refresh = () => { qc.invalidateQueries({ queryKey: ["maintenance"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); };
  const targets = kind === "group" ? dash?.groups.map((g) => ({ id: g.id, name: g.name })) : kind === "service" ? dash?.services.map((s) => ({ id: s.id, name: s.name })) : [];

  return (
    <section className="card space-y-3 p-5" aria-labelledby="h-maint">
      <h2 id="h-maint" className="font-semibold">Maintenance windows</h2>
      <p className="text-sm text-muted">Hold alerts while you work on something. Checks keep running and history stays honest; if a service is still down when the window ends, you get one alert then.</p>
      {!!data?.windows.length && (
        <ul className="space-y-1.5 text-sm">
          {data.windows.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
              <Wrench size={14} className={w.active ? "text-warn-fg" : "text-muted"} aria-hidden />
              <span className="min-w-0 flex-1"><b className="font-medium">{w.targetName}</b> <span className="text-muted">· {w.active ? `until ${fmt(w.endsAt)}` : `${fmt(w.startsAt)} – ${fmt(w.endsAt)}`}</span></span>
              <button className="btn !min-h-7 !px-2 text-xs" onClick={async () => { await api(`/api/maintenance/${w.id}`, { method: "DELETE" }); refresh(); }} aria-label={`${w.active ? "End" : "Cancel"} maintenance for ${w.targetName}`}>{w.active ? "End now" : <Trash2 size={12} />}</button>
            </li>
          ))}
        </ul>
      )}
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
        e.preventDefault(); setNote("");
        const f = new FormData(e.currentTarget);
        const start = String(f.get("start") || "");
        const startsAt = start ? new Date(start).getTime() : undefined;
        try {
          await api("/api/maintenance", { method: "POST", body: { kind, targetId: kind === "all" ? undefined : String(f.get("target")), startsAt, minutes: Number(f.get("minutes")) } });
          refresh(); setNote("Scheduled");
        } catch (x) { setNote(msg(x)); }
      }}>
        <div><label className="label" htmlFor="m-kind">Covers</label>
          <select id="m-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="all">Everything</option><option value="group">A group</option><option value="service">One service</option></select></div>
        {kind !== "all" && <div><label className="label" htmlFor="m-target">{kind === "group" ? "Group" : "Service"}</label>
          <select id="m-target" name="target" className="input" required>{targets?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>}
        <div><label className="label" htmlFor="m-start">Starts (blank = now)</label><input id="m-start" name="start" type="datetime-local" className="input" min={localInput(Date.now())} /></div>
        <div><label className="label" htmlFor="m-dur">For</label>
          <select id="m-dur" name="minutes" className="input" defaultValue={60}>{DURATIONS.map(([l, m]) => <option key={m} value={m}>{l}</option>)}</select></div>
        <div className="flex items-center gap-2 sm:col-span-2"><button className="btn btn-primary">Start / schedule</button><span className="text-sm text-muted" role="status">{note}</span></div>
      </form>
    </section>
  );
}
