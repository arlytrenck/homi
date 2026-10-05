/**
 * Homi plugin SDK. A plugin is compiled into the image (no runtime code loading).
 * Widgets return a small, shared output shape that one renderer displays, so authors
 * only write server-side fetch code.
 */

export type FieldSpec =
  | { kind: "text" | "textarea" | "url" | "number"; label: string; required?: boolean; placeholder?: string; help?: string }
  | { kind: "secret"; label: string; required?: boolean; help?: string }
  | { kind: "boolean"; label: string; help?: string }
  | { kind: "select"; label: string; options: { value: string; label: string }[]; required?: boolean };

export type Tone = "ok" | "warn" | "down" | "neutral";

export interface WidgetOutput {
  /** Big-number stats, e.g. { label: "Queries", value: "31,482" }. */
  stats?: { label: string; value: string; hint?: string; tone?: Tone }[];
  /** Used/total meters, e.g. CPU, memory, pool usage. `value` is 0..1. */
  meters?: { label: string; value: number; text?: string }[];
  /** Compact list rows, e.g. containers, upcoming episodes. */
  rows?: { primary: string; secondary?: string; tone?: Tone; href?: string }[];
  /** Free text shown under the content (small, muted). */
  note?: string;
}

export interface HttpInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
  form?: Record<string, string>;
  timeoutMs?: number;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export interface IntegrationContext {
  baseUrl: string;
  config: Record<string, any>;
  secrets: Record<string, string>;
  ignoreTls: boolean;
  /** SSRF-guarded request relative to baseUrl. Throws HttpError on non-2xx. */
  json<T = any>(path: string, init?: HttpInit): Promise<T>;
  /** Same, but returns status instead of throwing. */
  raw(path: string, init?: HttpInit): Promise<{ status: number; text: string; json<T = any>(): T; headers: Record<string, string> }>;
  /** Per-integration scratch cache (e.g. session ids). */
  cache: { get<T>(k: string): T | undefined; set<T>(k: string, v: T, ttlMs: number): void };
}

export interface WidgetDef {
  /** Namespaced id, e.g. "pihole.summary". */
  id: string;
  title: string;
  sizes?: ("sm" | "md" | "lg")[];
  options?: Record<string, FieldSpec>;
  minIntervalS?: number;
  fetch(ctx: IntegrationContext, options: Record<string, any>): Promise<WidgetOutput>;
}

export type TestResult = { ok: true; version?: string } | { ok: false; error: string };

export interface IntegrationPlugin {
  id: string;
  name: string;
  /** lucide icon name used in the UI. */
  icon: string;
  description: string;
  baseUrlPlaceholder: string;
  config?: Record<string, FieldSpec>;
  secrets: Record<string, FieldSpec & { kind: "secret" }>;
  test(ctx: IntegrationContext): Promise<TestResult>;
  widgets: WidgetDef[];
}

export interface CoreWidgetContext { fetchJson<T = any>(url: string): Promise<T> }
export interface CoreWidgetDef extends Omit<WidgetDef, "fetch"> {
  fetch(ctx: CoreWidgetContext, options: Record<string, any>): Promise<WidgetOutput>;
}
