"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Req =
  | { kind: "confirm"; message: string; danger?: boolean; resolve: (v: boolean) => void }
  | { kind: "prompt"; label: string; initial: string; resolve: (v: string | null) => void };

interface Api {
  /** In-page replacement for window.confirm (which many embedded browsers block). */
  confirm(message: string, opts?: { danger?: boolean }): Promise<boolean>;
  /** In-page replacement for window.prompt. Resolves null on cancel. */
  prompt(label: string, initial?: string): Promise<string | null>;
}
const Ctx = createContext<Api | null>(null);
export const useDialogs = () => { const c = useContext(Ctx); if (!c) throw new Error("DialogsProvider missing"); return c; };

export function DialogsProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<Req | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");

  const api: Api = {
    confirm: useCallback((message, opts) => new Promise<boolean>((resolve) => setReq({ kind: "confirm", message, danger: opts?.danger ?? true, resolve })), []),
    prompt: useCallback((label, initial = "") => new Promise<string | null>((resolve) => { setText(initial); setReq({ kind: "prompt", label, initial, resolve }); }), []),
  };

  useEffect(() => { if (req) ref.current?.showModal(); }, [req]);

  const finish = (value: boolean | string | null) => {
    if (!req) return;
    if (req.kind === "confirm") req.resolve(value === true); else req.resolve(typeof value === "string" ? value : null);
    ref.current?.close();
    setReq(null);
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      {req && (
        <dialog ref={ref} onCancel={(e) => { e.preventDefault(); finish(req.kind === "confirm" ? false : null); }} className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-0 text-fg backdrop:bg-black/50" aria-labelledby="dlg-title">
          <form method="dialog" className="space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); finish(req.kind === "confirm" ? true : text.trim() || null); }}>
            {req.kind === "confirm" ? (
              <p id="dlg-title">{req.message}</p>
            ) : (
              <div><label id="dlg-title" htmlFor="dlg-input" className="label">{req.label}</label><input id="dlg-input" className="input" value={text} onChange={(e) => setText(e.target.value)} autoFocus /></div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => finish(req.kind === "confirm" ? false : null)}>Cancel</button>
              <button type="submit" className={`btn ${req.kind === "confirm" && req.danger ? "btn-danger" : "btn-primary"}`} autoFocus={req.kind === "confirm"}>{req.kind === "confirm" ? (req.danger ? "Delete" : "OK") : "Save"}</button>
            </div>
          </form>
        </dialog>
      )}
    </Ctx.Provider>
  );
}
