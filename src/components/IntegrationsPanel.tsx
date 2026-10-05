"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import type { IntegrationDTO, PluginDTO, PluginsResponse } from "@/lib/types";
import { FieldForm, readFields } from "./FieldForm";

function IntegrationDialog({ plugin, existing, onClose, onSaved }: { plugin: PluginDTO; existing: IntegrationDTO | null; onClose: () => void; onSaved: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { ref.current?.showModal(); }, []);

  const read = (form: HTMLFormElement) => {
    const f = new FormData(form);
    return { name: String(f.get("name")), baseUrl: String(f.get("baseUrl")).trim(), ignoreTls: f.get("ignoreTls") === "on", config: readFields(form, plugin.config, "c"), secrets: readFields(form, plugin.secrets, "s") };
  };
  async function test(form: HTMLFormElement) {
    setTestMsg({ ok: true, text: "Testing…" });
    try {
      const { name: _n, ...rest } = read(form); void _n;
      const r = await api<{ ok: boolean; version?: string; error?: string }>("/api/integrations/test", { method: "POST", body: { ...rest, type: plugin.id, integrationId: existing?.id } });
      setTestMsg({ ok: r.ok, text: r.ok ? `Connected${r.version ? ` (${r.version})` : ""}` : `Failed: ${r.error}` });
    } catch (x) { setTestMsg({ ok: false, text: x instanceof ApiClientError ? x.message : "Test failed" }); }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(null);
    try {
      const b = read(e.currentTarget);
      await api(existing ? `/api/integrations/${existing.id}` : "/api/integrations", { method: existing ? "PATCH" : "POST", body: existing ? b : { ...b, type: plugin.id } });
      onSaved();
    } catch (x) { setErr(x instanceof ApiClientError ? x.message : "Failed to save"); }
  }
  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-0 text-fg backdrop:bg-black/50 max-sm:mb-0 max-sm:rounded-b-none">
      <form onSubmit={submit} className="space-y-3 p-5">
        <div><h2 className="text-lg font-semibold">{existing ? "Edit" : "Add"} {plugin.name}</h2><p className="text-sm text-muted">{plugin.description}</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="i-name">Name</label><input id="i-name" name="name" className="input" required defaultValue={existing?.name ?? plugin.name} /></div>
          <div><label className="label" htmlFor="i-url">Base URL *</label><input id="i-url" name="baseUrl" className="input" required placeholder={plugin.baseUrlPlaceholder} defaultValue={existing?.baseUrl} /></div>
          <FieldForm fields={plugin.config} values={existing?.config} prefix="c" />
          <FieldForm fields={plugin.secrets} secretsSet={existing?.secrets} prefix="s" />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ignoreTls" defaultChecked={existing?.ignoreTls} /> Ignore TLS errors (self-signed certificates)</label>
        <div className="flex items-center gap-2"><button type="button" className="btn" onClick={(e) => test(e.currentTarget.form!)}>Test connection</button><span role="status" className={`text-sm ${testMsg && !testMsg.ok ? "text-down" : "text-muted"}`}>{testMsg?.text}</span></div>
        {err && <p role="alert" className="text-sm text-down">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={() => ref.current?.close()}>Cancel</button><button className="btn btn-primary">Save</button></div>
      </form>
    </dialog>
  );
}

export function IntegrationsPanel() {
  const qc = useQueryClient();
  const plugins = useQuery({ queryKey: ["plugins"], queryFn: () => api<PluginsResponse>("/api/plugins"), staleTime: Infinity });
  const ints = useQuery({ queryKey: ["integrations"], queryFn: () => api<{ integrations: IntegrationDTO[] }>("/api/integrations") });
  const [dlg, setDlg] = useState<{ plugin: PluginDTO; existing: IntegrationDTO | null } | null>(null);
  const [pick, setPick] = useState("");
  const list = ints.data?.integrations ?? [];
  const refresh = () => { qc.invalidateQueries({ queryKey: ["integrations"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); };
  const find = (t: string) => plugins.data?.integrations.find((p) => p.id === t);

  return (
    <section className="card space-y-3 p-5" aria-labelledby="h-int">
      <h2 id="h-int" className="font-semibold">Integrations</h2>
      <p className="text-sm text-muted">Connect services, then add their widgets from the dashboard (Edit &rarr; Add widget). Credentials are encrypted at rest and never shown again.</p>
      <ul className="divide-y divide-border">
        {list.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{i.name}</span><span className="block truncate text-xs text-muted">{find(i.type)?.name ?? i.type} · {i.baseUrl}{i.lastError ? ` · ${i.lastError}` : ""}</span></span>
            {i.lastError ? <span className="text-xs text-down">error</span> : i.lastOkAt ? <span className="text-xs text-ok">ok</span> : null}
            <button className="btn !min-h-8 !px-2" aria-label={`Edit ${i.name}`} onClick={() => find(i.type) && setDlg({ plugin: find(i.type)!, existing: i })}><Pencil size={14} /></button>
            <button className="btn btn-danger !min-h-8 !px-2" aria-label={`Delete ${i.name}`} onClick={async () => { if (confirm(`Delete ${i.name} and its widgets?`)) { await api(`/api/integrations/${i.id}`, { method: "DELETE" }); refresh(); } }}><Trash2 size={14} /></button>
          </li>
        ))}
        {!list.length && <li className="py-2 text-sm text-muted">No integrations yet.</li>}
      </ul>
      <div className="flex gap-2">
        <select aria-label="Integration type" className="input !w-auto min-w-48" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Add integration…</option>{plugins.data?.integrations.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="btn" disabled={!pick} onClick={() => { const p = find(pick); if (p) { setDlg({ plugin: p, existing: null }); setPick(""); } }}><Plus size={14} /> Add</button>
      </div>
      {dlg && <IntegrationDialog key={dlg.existing?.id ?? dlg.plugin.id} plugin={dlg.plugin} existing={dlg.existing} onClose={() => setDlg(null)} onSaved={() => { setDlg(null); refresh(); }} />}
    </section>
  );
}
