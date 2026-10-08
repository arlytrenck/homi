"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import type { DashboardDTO } from "@/lib/types";

type Kind = "webhook" | "ntfy";
interface Dest { id: string; kind: Kind; groupIds: string[]; tags: string[]; urlSet: boolean; enabled: boolean; onRecovery: boolean; last: { ts: number; ok: boolean; error?: string } | null }
interface Row { id?: string; kind: Kind; scoped: boolean; groupIds: string[]; tags: string; url: string; urlSet: boolean; enabled: boolean; onRecovery: boolean; last: Dest["last"]; note?: string }
const MAX = 5;
const NONE = "__none__";
const parseTags = (s: string) => [...new Set(s.split(",").map((t) => t.trim()).filter(Boolean))];
const blank = (): Row => ({ kind: "webhook", scoped: false, groupIds: [], tags: "", url: "", urlSet: false, enabled: true, onRecovery: true, last: null });
const msg = (x: unknown) => (x instanceof ApiClientError ? x.message : "Failed");

export function NotificationsPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["notifications"], queryFn: () => api<{ destinations: Dest[] }>("/api/notifications") });
  const { data: dash } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<DashboardDTO>("/api/dashboard") });
  const groups = dash?.groups ?? [];
  const knownTags = [...new Set((dash?.services ?? []).flatMap((s) => s.tags))].sort();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => { if (data) setRows(data.destinations.length ? data.destinations.map((d) => ({ ...d, url: "", tags: d.tags.join(", "), scoped: d.groupIds.length + d.tags.length > 0 })) : [blank()]); }, [data]);
  if (!rows) return null;
  const set = (i: number, patch: Partial<Row>) => setRows((r) => r!.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const many = rows.length > 1;

  return (
    <section className="card space-y-3 p-5" aria-labelledby="h-notify">
      <h2 id="h-notify" className="font-semibold">Alerts</h2>
      <p className="text-sm text-muted">Get a message when a service goes down, and when it comes back. Add up to {MAX} destinations. URLs are stored encrypted.</p>
      <datalist id="n-known-tags">{knownTags.map((t) => <option key={t} value={t} />)}</datalist>
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault(); setNote("");
        const destinations = rows.filter((r) => r.url || r.urlSet).map((r) => ({ id: r.id, kind: r.kind, url: r.url || undefined, enabled: r.enabled, onRecovery: r.onRecovery, groupIds: r.scoped ? r.groupIds : [], tags: r.scoped ? parseTags(r.tags) : [] }));
        try { await api("/api/notifications", { method: "PUT", body: { destinations } }); await qc.invalidateQueries({ queryKey: ["notifications"] }); setNote("Saved"); } catch (x) { setNote(msg(x)); }
      }}>
        {rows.map((r, i) => (
          <fieldset key={r.id ?? `new-${i}`} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
            <legend className="px-1 text-xs text-muted">Destination {i + 1}</legend>
            <div><label className="label" htmlFor={`n-kind-${i}`}>Type</label>
              <select id={`n-kind-${i}`} className="input" value={r.kind} onChange={(e) => set(i, { kind: e.target.value as Kind })}><option value="webhook">Webhook (JSON: Discord, Slack, Home Assistant…)</option><option value="ntfy">ntfy</option></select></div>
            <div><label className="label" htmlFor={`n-url-${i}`}>URL {r.urlSet && <span className="text-muted">(saved — leave blank to keep)</span>}</label>
              <input id={`n-url-${i}`} type="url" className="input" placeholder={r.urlSet ? "••••••••" : "https://"} autoComplete="off" value={r.url} onChange={(e) => set(i, { url: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={r.enabled} onChange={(e) => set(i, { enabled: e.target.checked })} /> Send alerts</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={r.onRecovery} onChange={(e) => set(i, { onRecovery: e.target.checked })} /> Also notify on recovery</label>
            <div className="sm:col-span-2">
              <label className="label" htmlFor={`n-scope-${i}`}>Alert for</label>
              <select id={`n-scope-${i}`} className="input sm:!w-auto" value={r.scoped ? "groups" : "all"} onChange={(e) => set(i, { scoped: e.target.value === "groups" })}><option value="all">All services</option><option value="groups">Only selected groups or tags</option></select>
              {r.scoped && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1" role="group" aria-label={`Groups for destination ${i + 1}`}>
                  {[...groups.map((g) => ({ id: g.id, name: g.name })), { id: NONE, name: "Ungrouped" }].map((g) => (
                    <label key={g.id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={r.groupIds.includes(g.id)} onChange={(e) => set(i, { groupIds: e.target.checked ? [...r.groupIds, g.id] : r.groupIds.filter((x) => x !== g.id) })} /> {g.name}</label>
                  ))}
                  <div className="w-full">
                    <label className="label" htmlFor={`n-tags-${i}`}>Tags (comma-separated)</label>
                    <input id={`n-tags-${i}`} className="input" list="n-known-tags" placeholder="e.g. critical, media" value={r.tags} onChange={(e) => set(i, { tags: e.target.value })} />
                  </div>
                  <p className="w-full text-xs text-muted">Services in any selected group, or carrying any listed tag, are routed here.</p>
                  {!r.groupIds.length && !parseTags(r.tags).length && <p className="w-full text-xs text-warn-fg">No group or tag selected: this destination will receive alerts for all services.</p>}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <button type="button" className="btn" onClick={async () => {
                set(i, { note: "Sending…" });
                try { const t = await api<{ ok: boolean; error?: string }>("/api/notifications/test", { method: "POST", body: { id: r.id, kind: r.kind, url: r.url || undefined } }); set(i, { note: t.ok ? "Test sent" : `Failed: ${t.error}` }); } catch (x) { set(i, { note: msg(x) }); }
              }}>Send test</button>
              {many && <button type="button" className="btn btn-danger" aria-label={`Remove destination ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 size={14} /></button>}
              <span className="text-sm text-muted" role="status">{r.note}</span>
            </div>
            {r.last && !r.last.ok && <p className="text-sm text-down-fg sm:col-span-2" role="alert">Last alert failed ({new Date(r.last.ts).toLocaleString()}): {r.last.error}</p>}
          </fieldset>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary">Save</button>
          {rows.length < MAX && <button type="button" className="btn" onClick={() => setRows([...rows, blank()])}><Plus size={14} /> Add destination</button>}
          <span className="text-sm text-muted" role="status">{note}</span>
        </div>
      </form>
    </section>
  );
}
