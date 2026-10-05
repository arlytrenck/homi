import { EventEmitter } from "node:events";

export type HomiEvent =
  | { type: "status"; checkId: string; status: string; latencyMs: number | null; ts: number }
  | { type: "config-changed" }
  | { type: "hoststats"; data: unknown };

const g = globalThis as unknown as { __homiHub?: EventEmitter };
export const hub = (g.__homiHub ??= new EventEmitter().setMaxListeners(200));
export const publish = (e: HomiEvent) => hub.emit("event", e);
