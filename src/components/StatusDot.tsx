import { Check, Minus, TriangleAlert, X } from "lucide-react";
import type { Status } from "@/lib/types";

const META: Record<Status, { Icon: typeof Check; cls: string; label: string }> = {
  up: { Icon: Check, cls: "bg-ok", label: "Up" },
  degraded: { Icon: TriangleAlert, cls: "bg-warn !text-black/80", label: "Degraded" },
  down: { Icon: X, cls: "bg-down", label: "Down" },
  unknown: { Icon: Minus, cls: "bg-unknown", label: "Unknown" },
};

/** Status is conveyed by shape + colour, never colour alone. */
export function StatusDot({ status, title }: { status: Status; title?: string }) {
  const { Icon, cls, label } = META[status];
  return (
    <span role="img" aria-label={label} title={title ?? label} className={`inline-grid h-4 w-4 shrink-0 place-items-center rounded-full text-white ${cls}`}>
      <Icon size={11} strokeWidth={3} aria-hidden />
    </span>
  );
}
