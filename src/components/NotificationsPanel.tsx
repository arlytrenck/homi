"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiClientError } from "@/lib/api-client";

interface N { enabled: boolean; kind: "webhook" | "ntfy"; urlSet: boolean; onRecovery: boolean; last: { ts: number; ok: boolean; error?: string } | null }
const msg = (x: unknown) => (x instanceof ApiClientError ? x.message : "Failed");

export function NotificationsPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["notifications"], queryFn: () => api<N>("/api/notifications") });
  const [note, setNote] = useState("");
  if (!data) return null;
  const read = (form: HTMLFormElement) => {
    const f = new FormData(form);
    return { enabled: f.get("enabled") === "on", kind: String(f.get("kind")) as N["kind"], url: String(f.get("url") || "") || undefined, onRecovery: f.get("onRecovery") === "on" };
  };
  return (
    <section className="card space-y-3 p-5" aria-labelledby="h-notify">
      <h2 id="h-notify" className="font-semibold">Alerts</h2>
      <p className="text-sm text-muted">Get a message when a service goes down, and when it comes back. The URL is stored encrypted.</p>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
        e.preventDefault(); setNote("");
        try { await api("/api/notifications", { method: "PUT", body: read(e.currentTarget) }); qc.invalidateQueries({ queryKey: ["notifications"] }); setNote("Saved"); } catch (x) { setNote(msg(x)); }
      }}>
        <div><label className="label" htmlFor="n-kind">Type</label>
          <select id="n-kind" name="kind" className="input" defaultValue={data.kind}><option value="webhook">Webhook (JSON: Discord, Slack, Home Assistant…)</option><option value="ntfy">ntfy</option></select></div>
        <div><label className="label" htmlFor="n-url">URL {data.urlSet && <span className="text-muted">(saved — leave blank to keep)</span>}</label>
          <input id="n-url" name="url" type="url" className="input" placeholder={data.urlSet ? "••••••••" : "https://"} autoComplete="off" /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={data.enabled} /> Send alerts</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="onRecovery" defaultChecked={data.onRecovery} /> Also notify on recovery</label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <button className="btn btn-primary">Save</button>
          <button type="button" className="btn" onClick={async (e) => {
            const { kind, url } = read(e.currentTarget.form!); setNote("Sending…");
            try { const r = await api<{ ok: boolean; error?: string }>("/api/notifications/test", { method: "POST", body: { kind, url } }); setNote(r.ok ? "Test sent" : `Failed: ${r.error}`); } catch (x) { setNote(msg(x)); }
          }}>Send test</button>
          <span className="text-sm text-muted" role="status">{note}</span>
        </div>
      </form>
      {data.last && !data.last.ok && <p className="text-sm text-down-fg" role="alert">Last alert failed ({new Date(data.last.ts).toLocaleString()}): {data.last.error}</p>}
    </section>
  );
}
