"use client";
import { useEffect, useState } from "react";
export function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 15_000); return () => clearInterval(t); }, []);
  if (!now) return <span className="w-24" />;
  return (
    <div className="text-right leading-tight max-sm:hidden" aria-label="Current time">
      <div className="text-lg font-medium tabular-nums">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
      <div className="text-xs text-muted">{now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</div>
    </div>
  );
}
