"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiClientError } from "@/lib/api-client";
import type { IntegrationDTO, PluginsResponse, WidgetDTO } from "@/lib/types";
import { FieldForm, readFields } from "./FieldForm";

export function WidgetDialog({ widget, onClose, onSaved }: { widget: WidgetDTO | null; onClose: () => void; onSaved: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const plugins = useQuery({ queryKey: ["plugins"], queryFn: () => api<PluginsResponse>("/api/plugins"), staleTime: Infinity });
  const ints = useQuery({ queryKey: ["integrations"], queryFn: () => api<{ integrations: IntegrationDTO[] }>("/api/integrations") });
  const [err, setErr] = useState<string | null>(null);

  const choices = useMemo(() => {
    if (!plugins.data || !ints.data) return [];
    const core = plugins.data.core.map((c) => ({ value: c.id, label: `${c.title} (built-in)`, options: c.options, integrationId: "" }));
    const fromInts = ints.data.integrations.flatMap((i) => (plugins.data!.integrations.find((p) => p.id === i.type)?.widgets ?? []).map((w) => ({ value: `${w.id}@${i.id}`, label: `${i.name}: ${w.title}`, options: w.options, integrationId: i.id })));
    return [...core, ...fromInts];
  }, [plugins.data, ints.data]);

  const current = widget ? `${widget.kind}${widget.integrationId ? "@" + widget.integrationId : ""}` : null;
  const [choice, setChoice] = useState(current ?? "core.hoststats");
  const sel = choices.find((c) => c.value === choice);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(null);
    if (!sel) return;
    const f = new FormData(e.currentTarget);
    const options = readFields(e.currentTarget, sel.options, "o");
    const common = { title: String(f.get("title") || "") || null, size: String(f.get("size")) as "md", hiddenPublic: f.get("hiddenPublic") !== "on", options };
    try {
      if (widget) await api(`/api/widgets/${widget.id}`, { method: "PATCH", body: { ...common, options } });
      else await api("/api/widgets", { method: "POST", body: { ...common, kind: sel.value.split("@")[0], integrationId: sel.integrationId || null } });
      onSaved();
    } catch (x) { setErr(x instanceof ApiClientError ? x.message : "Failed to save"); }
  }

  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-0 text-fg backdrop:bg-black/50 max-sm:mb-0 max-sm:rounded-b-none">
      <form onSubmit={submit} className="space-y-3 p-5">
        <h2 className="text-lg font-semibold">{widget ? "Edit widget" : "Add widget"}</h2>
        {!widget && <div><label className="label" htmlFor="w-kind">Widget</label>
          <select id="w-kind" className="input" value={choice} onChange={(e) => setChoice(e.target.value)}>{choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          {ints.data && !ints.data.integrations.length && <p className="mt-1 text-xs text-muted">Add an integration in Settings to get more widgets.</p>}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="w-title">Title (optional)</label><input id="w-title" name="title" className="input" defaultValue={widget?.title ?? ""} /></div>
          <div><label className="label" htmlFor="w-size">Size</label><select id="w-size" name="size" className="input" defaultValue={widget?.size ?? "md"}><option value="md">Normal</option><option value="lg">Wide</option></select></div>
          {sel && <FieldForm key={sel.value} fields={sel.options} values={widget?.options} prefix="o" />}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="hiddenPublic" defaultChecked={widget ? !widget.hiddenPublic : false} /> Show in public view</label>
        {err && <p role="alert" className="text-sm text-down">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={() => ref.current?.close()}>Cancel</button><button className="btn btn-primary" disabled={!sel}>Save</button></div>
      </form>
    </dialog>
  );
}
