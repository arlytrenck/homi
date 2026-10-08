"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Repeat, Trash2, Wrench } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import type { DashboardDTO } from "@/lib/types";

interface W { id: string; name: string; kind: string; targetName: string; startsAt: number; endsAt: number; active: boolean }
interface Sch { id: string; name: string; targetName: string; summary: string; enabled: boolean; active: boolean }
const DURATIONS: [string, number][] = [["30 minutes", 30], ["1 hour", 60], ["2 hours", 120], ["4 hours", 240], ["8 hours", 480], ["12 hours", 720], ["1 day", 1440]];
const ONE_OFF_EXTRA: [string, number][] = [["1 week", 10080]];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fmt = (t: number) => new Date(t).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
const localInput = (t: number) => { const d = new Date(t - new Date(t).getTimezoneOffset() * 60_000); return d.toISOString().slice(0, 16); };
const browserTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; } };
const validTz = (tz: string) => { try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; } };
const msg = (x: unknown) => (x instanceof ApiClientError ? `${x.message}${x.fields ? " – " + Object.values(x.fields).flat().join(", ") : ""}` : "Failed");

export function MaintenancePanel() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["maintenance"], queryFn: () => api<{ windows: W[]; schedules: Sch[] }>("/api/maintenance") });
  const { data: dash } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<DashboardDTO>("/api/dashboard") });
  const [kind, setKind] = useState<"all" | "group" | "service">("all");
  const [weekly, setWeekly] = useState(false);
  const [days, setDays] = useState<number[]>([0]);
  const [tz, setTz] = useState(browserTz);
  const [note, setNote] = useState("");
  const refresh = () => { qc.invalidateQueries({ queryKey: ["maintenance"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); };
  const targets = kind === "group" ? dash?.groups.map((g) => ({ id: g.id, name: g.name })) : kind === "service" ? dash?.services.map((s) => ({ id: s.id, name: s.name })) : [];

  return (
    <section className="card space-y-3 p-5" aria-labelledby="h-maint">
      <h2 id="h-maint" className="font-semibold">Maintenance windows</h2>
      <p className="text-sm text-muted">Hold alerts while you work on something, once or on a weekly schedule. Checks keep running and history stays honest; if a service is still down when a window ends, you get one alert then.</p>
      {!!data?.windows.length && (
        <ul className="space-y-1.5 text-sm" aria-label="One-off windows">
          {data.windows.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
              <Wrench size={14} className={w.active ? "text-warn-fg" : "text-muted"} aria-hidden />
              <span className="min-w-0 flex-1"><b className="font-medium">{w.targetName}</b> <span className="text-muted">· {w.active ? `until ${fmt(w.endsAt)}` : `${fmt(w.startsAt)} – ${fmt(w.endsAt)}`}</span></span>
              <button className="btn !min-h-7 !px-2 text-xs" onClick={async () => { await api(`/api/maintenance/${w.id}`, { method: "DELETE" }); refresh(); }} aria-label={`${w.active ? "End" : "Cancel"} maintenance for ${w.targetName}`}>{w.active ? "End now" : <Trash2 size={12} />}</button>
            </li>
          ))}
        </ul>
      )}
      {!!data?.schedules.length && (
        <ul className="space-y-1.5 text-sm" aria-label="Weekly schedules">
          {data.schedules.map((s) => (
            <li key={s.id} className={`flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 ${s.enabled ? "" : "opacity-60"}`}>
              <Repeat size={14} className={s.active ? "text-warn-fg" : "text-muted"} aria-hidden />
              <span className="min-w-0 flex-1"><b className="font-medium">{s.targetName}</b> <span className="text-muted">· {s.summary}{s.active ? " · running now" : ""}{s.enabled ? "" : " · paused"}</span></span>
              <button className="btn !min-h-7 !px-2 text-xs" onClick={async () => { await api(`/api/maintenance/schedules/${s.id}`, { method: "PATCH", body: { enabled: !s.enabled } }); refresh(); }} aria-label={`${s.enabled ? "Pause" : "Resume"} schedule for ${s.targetName}`}>{s.enabled ? "Pause" : "Resume"}</button>
              <button className="btn btn-danger !min-h-7 !px-2 text-xs" onClick={async () => { await api(`/api/maintenance/schedules/${s.id}`, { method: "DELETE" }); refresh(); }} aria-label={`Delete schedule for ${s.targetName}`}><Trash2 size={12} /></button>
            </li>
          ))}
        </ul>
      )}
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
        e.preventDefault(); setNote("");
        const f = new FormData(e.currentTarget);
        const scope = { kind, targetId: kind === "all" ? undefined : String(f.get("target")) };
        const minutes = Number(f.get("minutes"));
        try {
          if (weekly) {
            if (!validTz(tz)) { setNote(`Unknown time zone “${tz}” (use e.g. Europe/Berlin)`); return; }
            await api("/api/maintenance/schedules", { method: "POST", body: { ...scope, days, startTime: String(f.get("time")), durationMin: minutes, tz } });
          } else {
            const start = String(f.get("start") || "");
            await api("/api/maintenance", { method: "POST", body: { ...scope, startsAt: start ? new Date(start).getTime() : undefined, minutes } });
          }
          refresh(); setNote(weekly ? "Schedule added" : "Scheduled");
        } catch (x) { setNote(msg(x)); }
      }}>
        <div><label className="label" htmlFor="m-kind">Covers</label>
          <select id="m-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="all">Everything</option><option value="group">A group</option><option value="service">One service</option></select></div>
        {kind !== "all" && <div><label className="label" htmlFor="m-target">{kind === "group" ? "Group" : "Service"}</label>
          <select id="m-target" name="target" className="input" required>{targets?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>}
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} /> Repeat weekly</label>
        {weekly ? <>
          <div className="sm:col-span-2" role="group" aria-label="Days">
            <span className="label">On</span>
            <div className="flex flex-wrap gap-x-3 gap-y-1">{DAYS.map((d, i) => <label key={d} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={days.includes(i)} onChange={(e) => setDays(e.target.checked ? [...days, i] : days.filter((x) => x !== i))} />{d}</label>)}</div>
          </div>
          <div><label className="label" htmlFor="m-time">Starts at</label><input id="m-time" name="time" type="time" className="input" defaultValue="03:00" required /></div>
          <div><label className="label" htmlFor="m-tz">Time zone</label><input id="m-tz" className="input" value={tz} onChange={(e) => setTz(e.target.value)} /></div>
        </> : (
          <div><label className="label" htmlFor="m-start">Starts (blank = now)</label><input id="m-start" name="start" type="datetime-local" className="input" min={localInput(Date.now())} /></div>
        )}
        <div><label className="label" htmlFor="m-dur">For</label>
          <select id="m-dur" name="minutes" className="input" defaultValue={60}>{[...DURATIONS, ...(weekly ? [] : ONE_OFF_EXTRA)].map(([l, m]) => <option key={m} value={m}>{l}</option>)}</select></div>
        <div className="flex items-center gap-2 sm:col-span-2"><button className="btn btn-primary">{weekly ? "Add schedule" : "Start / schedule"}</button><span className="text-sm text-muted" role="status">{note}</span></div>
      </form>
    </section>
  );
}
