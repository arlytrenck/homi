"use client";
import { useEffect, useRef, useState } from "react";
import { api, ApiClientError } from "@/lib/api-client";
import type { GroupDTO, ServiceDTO } from "@/lib/types";

const hostOf = (u: string) => { try { return new URL(u).host; } catch { return u; } };

export function ServiceDialog({ service, groups, defaultGroupId, onClose, onSaved }: { service: ServiceDTO | null; groups: GroupDTO[]; defaultGroupId?: string | null; onClose: () => void; onSaved: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ctype, setCtype] = useState<string>(service?.status?.type ?? "http");
  const [monitor, setMonitor] = useState(service ? !!service.status : true);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  useEffect(() => { ref.current?.showModal(); }, []);

  function read(form: HTMLFormElement) {
    const f = new FormData(form);
    const url = String(f.get("url"));
    return {
      name: String(f.get("name")), url, description: String(f.get("description") || "") || null, icon: String(f.get("icon") || "") || null,
      tags: String(f.get("tags") || "").split(",").map((t) => t.trim()).filter(Boolean),
      groupId: String(f.get("groupId") || "") || null, hiddenPublic: f.get("hiddenPublic") === "on", alertsMuted: f.get("alertsMuted") === "on",
      check: monitor ? { type: ctype as "http", target: ctype === "heartbeat" ? "heartbeat" : String(f.get("target") || (ctype === "tls" ? hostOf(url) : url)), intervalS: Number(f.get("intervalS")) || 60, timeoutMs: 5000, httpMethod: String(f.get("httpMethod") || "GET") as "GET", expectedStatus: String(f.get("expectedStatus") || "200-399"), keyword: String(f.get("keyword") || "") || null, ignoreTls: f.get("ignoreTls") === "on", enabled: true } : null,
    };
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(null);
    try {
      const body = service?.source === "docker" ? { groupId: read(e.currentTarget).groupId, alertsMuted: read(e.currentTarget).alertsMuted } : read(e.currentTarget);
      await api(service ? `/api/services/${service.id}` : "/api/services", { method: service ? "PATCH" : "POST", body });
      onSaved();
    } catch (x) { setErr(x instanceof ApiClientError ? `${x.message}${x.fields ? " – " + Object.keys(x.fields).join(", ") : ""}` : "Failed to save"); }
  }

  async function test(form: HTMLFormElement) {
    const c = read(form).check; if (!c) return;
    setTestMsg("Testing…");
    try { const r = await api<{ ok: boolean; latencyMs: number | null; error?: string }>("/api/checks/test", { method: "POST", body: c }); setTestMsg(r.ok ? `OK (${r.latencyMs ?? "?"} ms)` : `Failed: ${r.error}`); }
    catch (x) { setTestMsg(x instanceof ApiClientError ? x.message : "Test failed"); }
  }

  const c = service?.status;
  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-0 text-fg backdrop:bg-black/50 max-sm:mb-0 max-sm:rounded-b-none">
      <form onSubmit={submit} className="space-y-3 p-5">
        <h2 className="text-lg font-semibold">{service ? "Edit service" : "Add service"}</h2>
        {service?.source === "docker" && <p className="rounded-lg bg-surface-2 p-3 text-sm text-muted">Managed by Docker labels. Change <code>homi.*</code> labels on the container to edit it; here you can only move it to another group or mute its alerts.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="s-name">Name</label><input id="s-name" name="name" className="input" required defaultValue={service?.name} readOnly={service?.source === "docker"} /></div>
          <div><label className="label" htmlFor="s-group">Group</label>
            <select id="s-group" name="groupId" className="input" defaultValue={service?.groupId ?? defaultGroupId ?? ""}><option value="">Ungrouped</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
        </div>
        <div><label className="label" htmlFor="s-url">URL</label><input id="s-url" name="url" type="url" className="input" required placeholder="https://" defaultValue={service?.url} readOnly={service?.source === "docker"} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="s-desc">Description</label><input id="s-desc" name="description" className="input" defaultValue={service?.description ?? ""} readOnly={service?.source === "docker"} /></div>
          <div><label className="label" htmlFor="s-icon">Icon (image URL or emoji)</label><input id="s-icon" name="icon" className="input" defaultValue={service?.icon ?? ""} readOnly={service?.source === "docker"} /></div>
        </div>
        <div><label className="label" htmlFor="s-tags">Tags (comma-separated)</label><input id="s-tags" name="tags" className="input" placeholder="e.g. critical, media" defaultValue={service?.tags.join(", ") ?? ""} readOnly={service?.source === "docker"} /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={monitor} disabled={service?.source === "docker"} onChange={(e) => setMonitor(e.target.checked)} /> Monitor this service</label>
        {monitor && (
          <fieldset disabled={service?.source === "docker"} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="c-type">Check type</label><select id="c-type" name="ctype" className="input" value={ctype} onChange={(e) => setCtype(e.target.value)}><option value="http">HTTP</option><option value="tcp">TCP port</option><option value="ping">Ping</option><option value="tls">TLS certificate expiry</option><option value="heartbeat">Heartbeat (cron / backup job)</option></select></div>
            <div><label className="label" htmlFor="c-int">Interval (seconds)</label><input id="c-int" name="intervalS" type="number" min={10} className="input" defaultValue={c?.intervalS ?? 60} /></div>
            {ctype === "heartbeat" ? (
              <div className="sm:col-span-2 space-y-1 text-sm">
                <p className="text-muted">Your job calls this URL when it finishes. The service goes down if nothing arrives within the interval plus 25%. Append <code>/fail</code> to report a failure.</p>
                {c?.token && c.type === "heartbeat"
                  ? <code className="block break-all rounded-lg bg-surface-2 p-2 text-xs" data-testid="heartbeat-url">{typeof location !== "undefined" ? location.origin : ""}/api/heartbeat/{c.token}</code>
                  : <p className="text-muted">Save to get the push URL.</p>}
              </div>
            ) : (
              <div className="sm:col-span-2"><label className="label" htmlFor="c-target">{ctype === "tls" ? "Host[:port] (defaults to the URL’s host, port 443)" : "Target (defaults to URL; host:port for TCP; host for ping)"}</label><input id="c-target" name="target" className="input" defaultValue={c?.target && c.target !== service?.url ? c.target : ""} /></div>
            )}
            {ctype === "http" && <>
              <div><label className="label" htmlFor="c-method">HTTP method</label><select id="c-method" name="httpMethod" className="input" defaultValue={c?.httpMethod ?? "GET"}><option value="GET">GET</option><option value="HEAD">HEAD (lighter)</option></select></div>
              <div><label className="label" htmlFor="c-exp">Expected status</label><input id="c-exp" name="expectedStatus" className="input" defaultValue={c?.expectedStatus ?? "200-399"} /></div>
              <div><label className="label" htmlFor="c-kw">Keyword (optional)</label><input id="c-kw" name="keyword" className="input" defaultValue={c?.keyword ?? ""} /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ignoreTls" defaultChecked={c?.ignoreTls} /> Ignore TLS errors</label>
            </>}
            {ctype === "tls" && <p className="text-sm text-muted sm:col-span-2">Degraded when the certificate expires within 14 days, down once it has expired. Self-signed certificates are fine.</p>}
            {ctype !== "heartbeat" && <div className="flex items-center gap-2"><button type="button" className="btn" onClick={(e) => test(e.currentTarget.form!)}>Test</button><span className="text-sm text-muted" aria-live="polite">{testMsg}</span></div>}
          </fieldset>
        )}
        {monitor && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="alertsMuted" defaultChecked={service?.alertsMuted} /> Mute down/recovery alerts for this service</label>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="hiddenPublic" defaultChecked={service?.hiddenPublic} disabled={service?.source === "docker"} /> Hide from public view</label>
        {err && <p role="alert" className="text-sm text-down-fg">{err}</p>}
        <div className="flex justify-end gap-2 pt-1"><button type="button" className="btn" onClick={() => ref.current?.close()}>Cancel</button><button className="btn btn-primary">Save</button></div>
      </form>
    </dialog>
  );
}
