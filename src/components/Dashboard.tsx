"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, PointerSensor, KeyboardSensor, TouchSensor, useSensor, useSensors, closestCenter, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Activity, GripVertical, Moon, Pencil, Plus, Search, Settings, Sun, Trash2, LogOut, Check } from "lucide-react";
import { api } from "@/lib/api-client";
import type { DashboardDTO, GroupDTO, ServiceDTO, Status } from "@/lib/types";
import { useViewer } from "./Providers";
import { StatusDot } from "./StatusDot";
import { ServiceIcon } from "./ServiceIcon";
import { ServiceDialog } from "./ServiceDialog";
import { Clock } from "./Clock";

const UNGROUPED = "__none__";

function Tile({ s, edit, onEdit, onDelete }: { s: ServiceDTO; edit: boolean; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id, disabled: !edit });
  const st = s.status;
  const tip = st ? `${st.status}${st.latencyMs != null ? ` · ${st.latencyMs} ms` : ""}` : "Not monitored";
  const body = (
    <>
      <ServiceIcon icon={s.icon} name={s.name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium" style={{ fontSize: "var(--text-tile)" }}>{s.name}</span>
        {s.description && <span className="block truncate text-xs text-muted">{s.description}</span>}
      </span>
      {st && <StatusDot status={st.status} title={tip} />}
    </>
  );
  const cls = "card flex min-h-14 items-center gap-3 transition-colors hover:border-accent";
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }} className="relative list-none">
      {edit ? (
        <div className={cls} style={{ padding: "var(--tile-pad)" }}>
          <button {...attributes} {...listeners} className="touch-none cursor-grab text-muted" aria-label={`Drag ${s.name}`}><GripVertical size={16} /></button>
          {body}
          <button onClick={onEdit} className="btn !min-h-8 !px-2" aria-label={`Edit ${s.name}`}><Pencil size={14} /></button>
          <button onClick={onDelete} className="btn btn-danger !min-h-8 !px-2" aria-label={`Delete ${s.name}`}><Trash2 size={14} /></button>
        </div>
      ) : (
        <a href={s.url} target={s.targetBlank ? "_blank" : undefined} rel="noopener noreferrer" className={cls} style={{ padding: "var(--tile-pad)" }} title={tip}>{body}</a>
      )}
    </li>
  );
}

function Section({ group, services, edit, onAdd, onEdit, onDelete, onRename, onRemove }: {
  group: GroupDTO | null; services: ServiceDTO[]; edit: boolean; onAdd: () => void; onEdit: (s: ServiceDTO) => void; onDelete: (s: ServiceDTO) => void; onRename?: () => void; onRemove?: () => void;
}) {
  const id = group?.id ?? UNGROUPED;
  const { setNodeRef } = useDroppable({ id });
  if (!group && !services.length && !edit) return null;
  const down = services.filter((s) => s.status?.status === "down").length;
  return (
    <section aria-labelledby={`g-${id}`} className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <h2 id={`g-${id}`} className="text-sm font-semibold uppercase tracking-wide text-muted">{group?.name ?? "Ungrouped"}</h2>
        {down > 0 && <span className="rounded-full bg-down px-2 text-xs text-white">{down} down</span>}
        {edit && group && <><button className="btn !min-h-7 !px-2 text-xs" onClick={onRename}><Pencil size={12} /> Rename</button><button className="btn btn-danger !min-h-7 !px-2 text-xs" onClick={onRemove}><Trash2 size={12} /></button></>}
        {edit && <button className="btn !min-h-7 !px-2 text-xs" onClick={onAdd}><Plus size={12} /> Service</button>}
      </div>
      <SortableContext items={services.map((s) => s.id)} strategy={rectSortingStrategy}>
        <ul ref={setNodeRef} className="grid min-h-6 p-0" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,16rem),1fr))", gap: "var(--tile-gap)" }}>
          {services.map((s) => <Tile key={s.id} s={s} edit={edit} onEdit={() => onEdit(s)} onDelete={() => onDelete(s)} />)}
        </ul>
      </SortableContext>
    </section>
  );
}

export function Dashboard() {
  const viewer = useViewer();
  const router = useRouter();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<DashboardDTO>("/api/dashboard") });
  const [edit, setEdit] = useState(false);
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<{ service: ServiceDTO | null; groupId?: string | null } | null>(null);
  const [dark, setDark] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => { setDark(document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches)); }, []);
  useEffect(() => { if (data?.settings.title) document.title = data.settings.title; }, [data?.settings.title]);

  // Live updates over SSE
  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onmessage = (m) => {
      const e = JSON.parse(m.data);
      if (e.type === "config-changed") qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (e.type === "status") qc.setQueryData<DashboardDTO>(["dashboard"], (d) => d && { ...d, services: d.services.map((s) => (s.status && s.status.id === e.checkId ? { ...s, status: { ...s.status, status: e.status as Status, latencyMs: e.latencyMs as number | null, checkedAt: e.ts as number } } : s)) });
    };
    return () => es.close();
  }, [qc]);

  // "/" focuses search
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); document.getElementById("search")?.focus(); } };
    addEventListener("keydown", h); return () => removeEventListener("keydown", h);
  }, []);

  const needle = q.trim().toLowerCase();
  const filtered = useMemo(() => (data?.services ?? []).filter((s) => !needle || [s.name, s.description ?? "", s.url, ...s.tags].some((t) => t.toLowerCase().includes(needle))), [data, needle]);

  if (!data) return <div className="grid min-h-dvh place-items-center text-muted" role="status">Loading…</div>;
  const groups = data.groups;
  const by = (gid: string | null) => filtered.filter((s) => (s.groupId ?? null) === gid);
  const refresh = () => qc.invalidateQueries({ queryKey: ["dashboard"] });
  const isEdit = edit && viewer === "admin";

  async function toggleTheme() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next; document.cookie = `homi_theme=${next}; path=/; max-age=31536000; samesite=lax`; setDark(!dark);
    if (viewer === "admin") api("/api/settings", { method: "PATCH", body: { theme: next } }).catch(() => {});
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || !data) return;
    const all = data.services;
    const a = all.find((s) => s.id === active.id); if (!a) return;
    const overSvc = all.find((s) => s.id === over.id);
    const targetGroup: string | null = overSvc ? overSvc.groupId : over.id === UNGROUPED ? null : String(over.id);
    const lists = new Map<string | null, string[]>([[null, []], ...groups.map((g) => [g.id, [] as string[]] as [string, string[]])]);
    for (const s of all) lists.get(s.groupId ?? null)?.push(s.id);
    const from = lists.get(a.groupId ?? null)!;
    from.splice(from.indexOf(a.id), 1);
    const to = lists.get(targetGroup)!;
    const idx = overSvc ? to.indexOf(overSvc.id) : to.length;
    to.splice(idx < 0 ? to.length : idx, 0, a.id);
    const payload = { groups: [...lists.entries()].map(([id, serviceIds]) => ({ id, serviceIds })) };
    qc.setQueryData<DashboardDTO>(["dashboard"], { ...data, services: payload.groups.flatMap((g) => g.serviceIds.map((id) => ({ ...all.find((s) => s.id === id)!, groupId: g.id }))) });
    await api("/api/layout", { method: "PUT", body: payload }).catch(refresh);
  }

  async function addGroup() { const name = prompt("Group name"); if (name?.trim()) { await api("/api/groups", { method: "POST", body: { name: name.trim() } }); refresh(); } }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-4 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-semibold">{data.settings.title}</h1>
        <Clock />
        <div className="relative w-full sm:w-64 sm:order-none order-last">
          <Search size={16} className="pointer-events-none absolute left-3 top-3 text-muted" aria-hidden />
          <input id="search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && filtered[0]) window.open(filtered[0].url, filtered[0].targetBlank ? "_blank" : "_self", "noopener"); if (e.key === "Escape") { setQ(""); (e.target as HTMLElement).blur(); } }} className="input !pl-9" placeholder="Search…  ( / )" aria-label="Search services" />
        </div>
        <Link href="/ops" className="btn" aria-label="Ops view"><Activity size={16} /><span className="max-sm:hidden">Ops</span></Link>
        <button className="btn" onClick={toggleTheme} aria-label="Toggle theme">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
        {viewer === "admin" ? (
          <>
            <button className={`btn ${edit ? "btn-primary" : ""}`} onClick={() => setEdit(!edit)} aria-pressed={edit}>{edit ? <><Check size={16} /> Done</> : <><Pencil size={16} /><span className="max-sm:hidden">Edit</span></>}</button>
            <Link href="/settings" className="btn" aria-label="Settings"><Settings size={16} /></Link>
            <button className="btn" aria-label="Sign out" onClick={async () => { await api("/api/auth/logout", { method: "POST" }); router.replace("/login"); router.refresh(); }}><LogOut size={16} /></button>
          </>
        ) : <Link href="/login" className="btn">Sign in</Link>}
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        {groups.map((g) => (
          <Section key={g.id} group={g} services={by(g.id)} edit={isEdit}
            onAdd={() => setDialog({ service: null, groupId: g.id })} onEdit={(s) => setDialog({ service: s })}
            onDelete={async (s) => { if (confirm(`Delete ${s.name}?`)) { await api(`/api/services/${s.id}`, { method: "DELETE" }); refresh(); } }}
            onRename={async () => { const name = prompt("Rename group", g.name); if (name?.trim()) { await api(`/api/groups/${g.id}`, { method: "PATCH", body: { name: name.trim() } }); refresh(); } }}
            onRemove={async () => { if (confirm(`Delete group "${g.name}"? Its services become ungrouped.`)) { await api(`/api/groups/${g.id}`, { method: "DELETE" }); refresh(); } }} />
        ))}
        <Section group={null} services={by(null)} edit={isEdit} onAdd={() => setDialog({ service: null })} onEdit={(s) => setDialog({ service: s })}
          onDelete={async (s) => { if (confirm(`Delete ${s.name}?`)) { await api(`/api/services/${s.id}`, { method: "DELETE" }); refresh(); } }} />
      </DndContext>

      {isEdit && <button className="btn" onClick={addGroup}><Plus size={16} /> Add group</button>}
      {!data.services.length && !groups.length && (
        <div className="card mx-auto mt-16 max-w-md p-8 text-center">
          <h2 className="text-lg font-semibold">Nothing here yet</h2>
          <p className="mt-1 text-sm text-muted">{viewer === "admin" ? "Click Edit, then add a group and your first service." : "Sign in to add services."}</p>
        </div>
      )}
      {needle && !filtered.length && <p className="text-center text-muted">No matches for “{q}”.</p>}
      {dialog && <ServiceDialog service={dialog.service} groups={groups} defaultGroupId={dialog.groupId} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); refresh(); }} />}
    </div>
  );
}
