"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { DndContext, PointerSensor, KeyboardSensor, TouchSensor, useSensor, useSensors, pointerWithin, rectIntersection, useDroppable, type CollisionDetection, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Activity, BellOff, ChartLine, ChevronDown, Container, GripVertical, Moon, Pencil, Plus, Search, Settings, Sun, Trash2, LogOut, Check } from "lucide-react";
import { api } from "@/lib/api-client";
import { useLiveDashboard } from "@/lib/live";
import type { DashboardDTO, GroupDTO, ServiceDTO, WidgetDTO } from "@/lib/types";
import { useViewer } from "./Providers";
import { useDialogs } from "./Dialogs";
import { StatusDot } from "./StatusDot";
import { ServiceIcon } from "./ServiceIcon";
import { ServiceDialog } from "./ServiceDialog";
import { Clock } from "./Clock";
import { BrandMark } from "./BrandMark";
import { WidgetCard } from "./WidgetCard";
import { WidgetDialog } from "./WidgetDialog";
import { ServiceDetail } from "./ServiceDetail";

const UNGROUPED = "__none__";

/** Prefer whatever is under the pointer (works for empty groups); fall back to overlap for keyboard drags. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

function Tile({ s, edit, onEdit, onDelete, onDetail }: { s: ServiceDTO; edit: boolean; onEdit: () => void; onDelete: () => void; onDetail: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id, disabled: !edit });
  const st = s.status;
  const tip = st ? `${st.status}${st.latencyMs != null ? ` · ${st.latencyMs} ms` : ""}` : "Not monitored";
  const body = (
    <>
      <ServiceIcon icon={s.icon} name={s.name} />
      <span className="min-w-[5rem] flex-1">
        <span className="block truncate font-medium" style={{ fontSize: "var(--text-tile)" }}>{s.name}</span>
        {(s.description || s.missing) && <span className="block truncate text-xs text-muted">{s.missing ? "Container not running" : s.description}</span>}
      </span>
      {s.alertsMuted && <BellOff size={13} className="shrink-0 text-muted" aria-label="Alerts muted" />}
      {s.source === "docker" && <Container size={13} className="shrink-0 text-muted" aria-label="Managed by Docker labels" />}
      {st?.latencyMs != null && st.status !== "down" && <span className="shrink-0 text-xs tabular-nums text-muted">{st.latencyMs} ms</span>}
      {st && <StatusDot status={st.status} title={tip} />}
    </>
  );
  const tone = st?.status === "down" ? "border-down/60 bg-down/10" : st?.status === "degraded" ? "border-warn/50" : "";
  const cls = `card flex min-h-14 items-center gap-3 transition-colors hover:border-accent ${tone}`;
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }} className="relative list-none">
      {edit ? (
        <div className={`${cls} flex-wrap`} style={{ padding: "var(--tile-pad)" }}>
          <button {...attributes} {...listeners} className="touch-none cursor-grab text-muted" aria-label={`Drag ${s.name}`}><GripVertical size={16} /></button>
          {body}
          <button onClick={onEdit} className="btn !min-h-8 !px-2" aria-label={`Edit ${s.name}`}><Pencil size={14} /></button>
          {s.source === "manual" && <button onClick={onDelete} className="btn btn-danger !min-h-8 !px-2" aria-label={`Delete ${s.name}`}><Trash2 size={14} /></button>}
        </div>
      ) : (
        <>
          <a href={s.url} target={s.targetBlank ? "_blank" : undefined} rel="noopener noreferrer" className={`${cls} ${st ? "!pr-11" : ""}`} style={{ padding: "var(--tile-pad)" }} title={tip}>{body}</a>
          {st && <button onClick={onDetail} className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg" aria-label={`${s.name} uptime details`}><ChartLine size={15} /></button>}
        </>
      )}
    </li>
  );
}

function Section({ group, services, edit, folded, onFold, onAdd, onEdit, onDelete, onDetail, onRename, onRemove }: {
  group: GroupDTO | null; services: ServiceDTO[]; edit: boolean; folded?: boolean; onFold?: () => void; onAdd: () => void; onEdit: (s: ServiceDTO) => void; onDelete: (s: ServiceDTO) => void; onDetail: (s: ServiceDTO) => void; onRename?: () => void; onRemove?: () => void;
}) {
  const id = group?.id ?? UNGROUPED;
  const { setNodeRef } = useDroppable({ id });
  if (!group && !services.length && !edit) return null;
  const down = services.filter((s) => s.status?.status === "down").length;
  return (
    <section aria-labelledby={`g-${id}`} className="mb-10">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 id={`g-${id}`} className="text-base font-semibold tracking-tight">
          {group && !edit ? <button className="flex items-center gap-1.5" onClick={onFold} aria-expanded={!folded}><ChevronDown size={16} className={`text-muted transition-transform ${folded ? "-rotate-90" : ""}`} aria-hidden />{group.name}</button> : (group?.name ?? "Ungrouped")}
        </h2>
        <span className="text-sm tabular-nums text-muted">{services.length}</span>
        {down > 0 && <span className="rounded-full bg-down px-2 py-0.5 text-xs font-medium text-white">{down} down</span>}
        {edit && group && <><button className="btn !min-h-7 !px-2 text-xs" onClick={onRename}><Pencil size={12} /> Rename</button><button className="btn btn-danger !min-h-7 !px-2 text-xs" onClick={onRemove}><Trash2 size={12} /></button></>}
        {edit && <button className="btn !min-h-7 !px-2 text-xs" onClick={onAdd}><Plus size={12} /> Service</button>}
      </div>
      {(!folded || edit) && <SortableContext items={services.map((s) => s.id)} strategy={rectSortingStrategy}>
        <ul ref={setNodeRef} className={`grid p-0 ${edit && !services.length ? "min-h-14 items-center justify-items-center rounded-[10px] border border-dashed border-border text-sm text-muted" : "min-h-6"}`} style={{ gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,16rem),1fr))", gap: "var(--tile-gap)" }}>
          {services.map((s) => <Tile key={s.id} s={s} edit={edit} onEdit={() => onEdit(s)} onDelete={() => onDelete(s)} onDetail={() => onDetail(s)} />)}
          {edit && !services.length && <li className="list-none" aria-hidden>Drop services here</li>}
        </ul>
      </SortableContext>}
    </section>
  );
}

export function Dashboard() {
  const viewer = useViewer();
  const dlg = useDialogs();
  const router = useRouter();
  const qc = useQueryClient();
  const { data, isError, refetch } = useLiveDashboard();
  const [detail, setDetail] = useState<string | null>(null);
  const [onlyBad, setOnlyBad] = useState(false);
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [edit, setEdit] = useState(false);
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<{ service: ServiceDTO | null; groupId?: string | null } | null>(null);
  const [wdialog, setWdialog] = useState<{ widget: WidgetDTO | null } | null>(null);
  const [dark, setDark] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => { setDark(document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches)); }, []);
  useEffect(() => { if (data?.settings.title) document.title = data.settings.title; }, [data?.settings.title]);

  // "/" focuses search
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); document.getElementById("search")?.focus(); } };
    addEventListener("keydown", h); return () => removeEventListener("keydown", h);
  }, []);

  const needle = q.trim().toLowerCase();
  const filtered = useMemo(() => (data?.services ?? []).filter((s) => (!onlyBad || s.status?.status === "down" || s.status?.status === "degraded") && (!needle || [s.name, s.description ?? "", s.url, ...s.tags].some((t) => t.toLowerCase().includes(needle)))), [data, needle, onlyBad]);

  if (!data) return isError
    ? <div className="grid min-h-dvh place-items-center"><div className="card p-6 text-center" role="alert"><p className="font-medium">Couldn’t load the dashboard</p><button className="btn btn-primary mt-3" onClick={() => refetch()}>Retry</button></div></div>
    : <div className="grid min-h-dvh place-items-center text-muted" role="status">Loading…</div>;
  const groups = data.groups;
  const mon = data.services.filter((s) => s.status);
  const bad = mon.filter((s) => s.status!.status === "down" || s.status!.status === "degraded").length;
  const summary = mon.length ? { bad: bad > 0, text: bad ? `${bad} of ${mon.length} services need attention` : `All ${mon.length} services up` } : null;
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
    const fromIdx = from.indexOf(a.id);
    const to = lists.get(targetGroup)!;
    const overIdxBefore = overSvc ? to.indexOf(overSvc.id) : -1;
    from.splice(fromIdx, 1);
    let idx = overSvc ? to.indexOf(overSvc.id) : to.length;
    // Moving forward within the same group lands after the target (as in arrayMove), not before it.
    if (overSvc && from === to && fromIdx < overIdxBefore) idx += 1;
    to.splice(idx < 0 ? to.length : idx, 0, a.id);
    const payload = { groups: [...lists.entries()].map(([id, serviceIds]) => ({ id, serviceIds })) };
    qc.setQueryData<DashboardDTO>(["dashboard"], { ...data, services: payload.groups.flatMap((g) => g.serviceIds.map((id) => ({ ...all.find((s) => s.id === id)!, groupId: g.id }))) });
    await api("/api/layout", { method: "PUT", body: payload }).catch(refresh);
  }

  function toggleFold(g: GroupDTO) {
    const next = !(folded[g.id] ?? g.collapsed);
    setFolded((f) => ({ ...f, [g.id]: next }));
    if (viewer === "admin") api(`/api/groups/${g.id}`, { method: "PATCH", body: { collapsed: next } }).catch(() => {});
  }

  async function addGroup() { const name = await dlg.prompt("Group name"); if (name?.trim()) { await api("/api/groups", { method: "POST", body: { name: name.trim() } }); refresh(); } }

  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-4 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <div className="mr-auto flex items-center gap-3">
          <BrandMark size={32} />
          <div>
            <h1 className="text-xl font-semibold leading-tight tracking-tight">{data.settings.title}</h1>
            {summary && (summary.bad
              ? <button className="flex items-center gap-1.5 text-left text-sm text-down-fg hover:underline" onClick={() => setOnlyBad(!onlyBad)} aria-pressed={onlyBad} title={onlyBad ? "Show all services" : "Show only services that need attention"}><span className="h-2 w-2 rounded-full bg-down" aria-hidden />{summary.text}{onlyBad && " · filtered"}</button>
              : <p className="flex items-center gap-1.5 text-sm text-muted" role="status"><span className="h-2 w-2 rounded-full bg-ok" aria-hidden />{summary.text}</p>)}
          </div>
        </div>
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

      {(data.widgets.length > 0 || isEdit) && (
        <section aria-label="Widgets" className="mb-8">
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,17rem),1fr))" }}>
            {data.widgets.map((w) => <WidgetCard key={w.id} w={w} edit={isEdit} onEdit={() => setWdialog({ widget: w })} onDelete={async () => { if (await dlg.confirm("Delete this widget?")) { await api(`/api/widgets/${w.id}`, { method: "DELETE" }); refresh(); } }} />)}
            {isEdit && <button className="card grid min-h-20 place-items-center border-dashed text-sm text-muted hover:border-accent" onClick={() => setWdialog({ widget: null })}><span className="flex items-center gap-1"><Plus size={14} /> Add widget</span></button>}
          </div>
        </section>
      )}

      <DndContext sensors={sensors} collisionDetection={collision} onDragEnd={onDragEnd}>
        {groups.map((g) => (
          <Section key={g.id} group={g} services={by(g.id)} edit={isEdit} folded={!needle && !onlyBad && (folded[g.id] ?? g.collapsed)} onFold={() => toggleFold(g)}
            onAdd={() => setDialog({ service: null, groupId: g.id })} onEdit={(s) => setDialog({ service: s })} onDetail={(s) => setDetail(s.id)}
            onDelete={async (s) => { if (await dlg.confirm(`Delete ${s.name}?`)) { await api(`/api/services/${s.id}`, { method: "DELETE" }); refresh(); } }}
            onRename={async () => { const name = await dlg.prompt("Rename group", g.name); if (name?.trim()) { await api(`/api/groups/${g.id}`, { method: "PATCH", body: { name: name.trim() } }); refresh(); } }}
            onRemove={async () => { if (await dlg.confirm(`Delete group "${g.name}"? Its services become ungrouped.`)) { await api(`/api/groups/${g.id}`, { method: "DELETE" }); refresh(); } }} />
        ))}
        <Section group={null} services={by(null)} edit={isEdit} onAdd={() => setDialog({ service: null })} onEdit={(s) => setDialog({ service: s })} onDetail={(s) => setDetail(s.id)}
          onDelete={async (s) => { if (await dlg.confirm(`Delete ${s.name}?`)) { await api(`/api/services/${s.id}`, { method: "DELETE" }); refresh(); } }} />
      </DndContext>

      {isEdit && <button className="btn" onClick={addGroup}><Plus size={16} /> Add group</button>}
      {!data.services.length && !groups.length && !isEdit && (
        <div className="card mx-auto mt-16 max-w-md p-8 text-center">
          <h2 className="text-lg font-semibold">Nothing here yet</h2>
          <p className="mt-1 text-sm text-muted">{viewer === "admin" ? "Click Edit, then add a group and your first service." : "Sign in to add services."}</p>
        </div>
      )}
      {needle && !filtered.length && <p className="text-center text-muted">No matches for “{q}”.</p>}
      {detail && data.services.find((s) => s.id === detail)?.status && <ServiceDetail service={data.services.find((s) => s.id === detail)!} onClose={() => setDetail(null)} />}
      {wdialog && <WidgetDialog widget={wdialog.widget} onClose={() => setWdialog(null)} onSaved={() => { setWdialog(null); qc.invalidateQueries({ queryKey: ["widget"] }); refresh(); }} />}
      {dialog && <ServiceDialog service={dialog.service} groups={groups} defaultGroupId={dialog.groupId} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); refresh(); }} />}
    </main>
  );
}
