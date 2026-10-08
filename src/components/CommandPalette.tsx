"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Activity, CornerDownLeft, History, LayoutGrid, LogIn, LogOut, Moon, Settings } from "lucide-react";
import { api } from "@/lib/api-client";
import { score } from "@/lib/palette";
import { toggleTheme } from "@/lib/theme";
import type { DashboardDTO, Status } from "@/lib/types";
import { useViewer } from "./Providers";
import { StatusDot } from "./StatusDot";
import { ServiceIcon } from "./ServiceIcon";

interface Item { id: string; label: string; hint?: string; run: () => void; icon?: React.ReactNode; status?: Status; keywords?: string }
const ORDER: Record<Status, number> = { down: 0, degraded: 1, unknown: 2, up: 3 };

/** ⌘K / Ctrl+K: jump to a service or a page, flip the theme, sign out. */
export function CommandPalette() {
  const router = useRouter();
  const admin = useViewer() === "admin";
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const ref = useRef<HTMLDialogElement>(null);
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<DashboardDTO>("/api/dashboard"), enabled: open });

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); } };
    addEventListener("keydown", h); return () => removeEventListener("keydown", h);
  }, []);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) { setQ(""); setSel(0); d.showModal(); }
    if (!open && d.open) d.close();
  }, [open]);

  const go = (path: string) => () => router.push(path);
  const items = useMemo<Item[]>(() => {
    const actions: Item[] = [
      { id: "a-home", label: "Dashboard", icon: <LayoutGrid size={16} />, run: go("/"), keywords: "home services" },
      { id: "a-ops", label: "Ops view", icon: <Activity size={16} />, run: go("/ops"), keywords: "status monitoring" },
      { id: "a-inc", label: "Incidents", icon: <History size={16} />, run: go("/incidents"), keywords: "outages history" },
      ...(admin ? [{ id: "a-set", label: "Settings", icon: <Settings size={16} />, run: go("/settings"), keywords: "alerts maintenance integrations backup" }] : []),
      { id: "a-theme", label: "Toggle light / dark theme", icon: <Moon size={16} />, run: () => { toggleTheme(admin); }, keywords: "dark mode" },
      admin
        ? { id: "a-out", label: "Sign out", icon: <LogOut size={16} />, run: async () => { await api("/api/auth/logout", { method: "POST" }); router.replace("/login"); router.refresh(); } }
        : { id: "a-in", label: "Sign in", icon: <LogIn size={16} />, run: go("/login") },
    ];
    const svcs: Item[] = (data?.services ?? []).slice().sort((a, b) => ORDER[a.status?.status ?? "unknown"] - ORDER[b.status?.status ?? "unknown"] || a.name.localeCompare(b.name)).map((s) => ({
      id: `s-${s.id}`, label: s.name, hint: s.description ?? new URL(s.url).host, status: s.status?.status, keywords: [s.url, ...s.tags].join(" "),
      icon: <ServiceIcon icon={s.icon} name={s.name} />, run: () => { if (s.targetBlank) window.open(s.url, "_blank", "noopener"); else location.assign(s.url); },
    }));
    return [...svcs, ...actions];
  }, [data, admin]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => {
    if (!q.trim()) return items.slice(0, 12);
    return items.map((i) => ({ i, s: Math.max(score(q, i.label), score(q, i.keywords ?? "") * 0.5) })).filter((r) => r.s > 0).sort((a, b) => b.s - a.s).slice(0, 12).map((r) => r.i);
  }, [items, q]);
  useEffect(() => setSel(0), [q]);
  useEffect(() => { document.getElementById(`cp-${results[sel]?.id}`)?.scrollIntoView({ block: "nearest" }); }, [sel, results]);

  const pick = (i?: Item) => { if (!i) return; setOpen(false); i.run(); };
  return (
    <dialog ref={ref} onClose={() => setOpen(false)} onClick={(e) => { if (e.target === ref.current) setOpen(false); }} aria-label="Command palette"
      className="m-0 mx-auto mt-[12vh] w-[min(34rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/50">
      {open && <>
      <input role="combobox" aria-expanded aria-controls="cp-list" aria-activedescendant={results[sel] ? `cp-${results[sel].id}` : undefined} aria-label="Type a service or command"
        value={q} onChange={(e) => setQ(e.target.value)} placeholder="Jump to a service or action…" autoComplete="off" spellCheck={false}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); pick(results[sel]); }
        }}
        className="w-full rounded-t-xl border-0 border-b border-border bg-transparent px-4 py-3.5 text-base outline-none placeholder:text-muted" />
      <ul id="cp-list" role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto p-1.5">
        {results.map((r, idx) => (
          <li key={r.id} id={`cp-${r.id}`} role="option" aria-selected={idx === sel} onMouseMove={() => setSel(idx)} onClick={() => pick(r)}
            className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${idx === sel ? "bg-surface-2" : ""}`}>
            <span className="grid h-6 w-6 shrink-0 place-items-center text-muted">{r.icon}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{r.label}</span>{r.hint && <span className="block truncate text-xs text-muted">{r.hint}</span>}</span>
            {r.status && <StatusDot status={r.status} />}
            {idx === sel && <CornerDownLeft size={14} className="shrink-0 text-muted" aria-hidden />}
          </li>
        ))}
        {!results.length && <li className="px-3 py-6 text-center text-sm text-muted" role="option" aria-selected="false" aria-disabled>No matches</li>}
      </ul>
      </>}
    </dialog>
  );
}
