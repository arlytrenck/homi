"use client";
import type { FieldSpecDTO } from "@/lib/types";

/** Renders a plugin's FieldSpec map. Uncontrolled inputs; read with readFields(). */
export function FieldForm({ fields, values = {}, secretsSet = {}, prefix }: { fields: Record<string, FieldSpecDTO>; values?: Record<string, any>; secretsSet?: Record<string, { set: true }>; prefix: string }) {
  return (
    <>
      {Object.entries(fields).map(([k, f]) => {
        const id = `${prefix}-${k}`;
        if (f.kind === "boolean") return <label key={k} className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name={`${prefix}:${k}`} defaultChecked={!!values[k]} /> {f.label}</label>;
        return (
          <div key={k} className={f.kind === "textarea" ? "sm:col-span-2" : ""}>
            <label className="label" htmlFor={id}>{f.label}{"required" in f && f.required ? " *" : ""}</label>
            {f.kind === "textarea" ? <textarea id={id} name={`${prefix}:${k}`} className="input min-h-24 py-2" defaultValue={values[k] ?? ""} />
              : f.kind === "select" ? <select id={id} name={`${prefix}:${k}`} className="input" defaultValue={values[k] ?? f.options[0]?.value}>{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
              : f.kind === "secret" ? <input id={id} name={`${prefix}:${k}`} type="password" autoComplete="off" className="input" placeholder={secretsSet[k] ? "•••••••• (saved; leave blank to keep)" : ""} />
              : <input id={id} name={`${prefix}:${k}`} type={f.kind === "number" ? "number" : f.kind === "url" ? "url" : "text"} step="any" className="input" placeholder={"placeholder" in f ? f.placeholder : undefined} defaultValue={values[k] ?? ""} />}
            {"help" in f && f.help && <p className="mt-1 text-xs text-muted">{f.help}</p>}
          </div>
        );
      })}
    </>
  );
}

export function readFields(form: HTMLFormElement, fields: Record<string, FieldSpecDTO>, prefix: string): Record<string, any> {
  const f = new FormData(form), out: Record<string, any> = {};
  for (const [k, spec] of Object.entries(fields)) {
    const raw = f.get(`${prefix}:${k}`);
    if (spec.kind === "boolean") out[k] = raw === "on";
    else if (spec.kind === "number") out[k] = raw === null || raw === "" ? undefined : Number(raw);
    else if (spec.kind === "secret") out[k] = raw ? String(raw) : undefined;
    else out[k] = raw === null ? undefined : String(raw);
  }
  return out;
}
