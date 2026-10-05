"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";

interface S { title: string; theme: string; publicView: boolean; allowLoopback: boolean; retentionHours: number }
const msg = (x: unknown) => (x instanceof ApiClientError ? x.message : "Failed");

function General() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => api<S>("/api/settings") });
  const [note, setNote] = useState("");
  if (!data) return null;
  const save = async (patch: Partial<S>) => { try { await api("/api/settings", { method: "PATCH", body: patch }); qc.invalidateQueries({ queryKey: ["settings"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); setNote("Saved"); } catch (x) { setNote(msg(x)); } };
  return (
    <section className="card space-y-4 p-5" aria-labelledby="h-general">
      <h2 id="h-general" className="font-semibold">General</h2>
      <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void save({ title: String(f.get("title")), retentionHours: Number(f.get("retention")) }); }} className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="title">Dashboard title</label><input id="title" name="title" className="input" defaultValue={data.title} maxLength={60} /></div>
        <div><label className="label" htmlFor="retention">Raw check history retention (hours)</label><input id="retention" name="retention" type="number" min={1} max={720} className="input" defaultValue={data.retentionHours} /></div>
        <div><button className="btn btn-primary">Save</button> <span className="ml-2 text-sm text-muted" role="status">{note}</span></div>
      </form>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={data.publicView} onChange={(e) => save({ publicView: e.target.checked })} /><span><b>Public read-only view.</b> Anyone who can reach Homi sees services not marked hidden. Status only; no error details or widget data.</span></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={data.allowLoopback} onChange={(e) => save({ allowLoopback: e.target.checked })} /><span><b>Allow checks against loopback (127.0.0.0/8).</b> Needed to monitor services on Homi’s own host from inside Docker host-networking. Link-local/metadata addresses are always blocked.</span></label>
    </section>
  );
}

function Security() {
  const [note, setNote] = useState("");
  return (
    <section className="card space-y-3 p-5" aria-labelledby="h-sec">
      <h2 id="h-sec" className="font-semibold">Change password</h2>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); try { await api("/api/auth/password", { method: "POST", body: { currentPassword: f.get("cur"), newPassword: f.get("new") } }); setNote("Password changed; other sessions signed out."); e.currentTarget.reset(); } catch (x) { setNote(msg(x)); } }}>
        <div><label className="label" htmlFor="cur">Current password</label><input id="cur" name="cur" type="password" className="input" autoComplete="current-password" required /></div>
        <div><label className="label" htmlFor="new">New password (min. 10)</label><input id="new" name="new" type="password" className="input" autoComplete="new-password" minLength={10} required /></div>
        <div><button className="btn btn-primary">Change password</button> <span className="ml-2 text-sm text-muted" role="status">{note}</span></div>
      </form>
    </section>
  );
}

function Backup() {
  const [yaml, setYaml] = useState("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [out, setOut] = useState("");
  const run = async (dryRun: boolean) => {
    try { const r = await api<Record<string, unknown>>("/api/config/import", { method: "POST", body: { yaml, mode, dryRun } }); setOut(`${dryRun ? "Preview" : "Imported"}: ${r.groupsCreated} groups, ${r.servicesCreated} new services, ${r.servicesUpdated} updated.`); }
    catch (x) { setOut(msg(x)); }
  };
  return (
    <section className="card space-y-3 p-5" aria-labelledby="h-bk">
      <h2 id="h-bk" className="font-semibold">Backup &amp; restore (YAML)</h2>
      <p className="text-sm text-muted">Exports groups, services and checks. Integration secrets are never exported.</p>
      <a className="btn" href="/api/config/export" download="homi.yaml">Download homi.yaml</a>
      <div><label className="label" htmlFor="yaml">Import YAML</label><textarea id="yaml" className="input min-h-32 py-2 font-mono text-xs" value={yaml} onChange={(e) => setYaml(e.target.value)} /></div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Import mode" className="input !w-auto" value={mode} onChange={(e) => setMode(e.target.value as "merge")}><option value="merge">Merge (match by name)</option><option value="replace">Replace everything</option></select>
        <button className="btn" onClick={() => run(true)} disabled={!yaml}>Preview</button>
        <button className="btn btn-primary" onClick={() => run(false)} disabled={!yaml}>Import</button>
        <span className="text-sm text-muted" role="status">{out}</span>
      </div>
    </section>
  );
}

export function SettingsView() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <div className="flex items-center gap-3"><Link href="/" className="btn" aria-label="Back to dashboard"><ArrowLeft size={16} /></Link><h1 className="text-xl font-semibold">Settings</h1></div>
      <General /><Security /><Backup />
    </div>
  );
}
