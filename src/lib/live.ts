"use client";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";
import type { DashboardDTO, Status } from "./types";

/** Dashboard data kept live over SSE: status events patch the cache in place; config changes and reconnects refetch. */
export function useLiveDashboard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => api<DashboardDTO>("/api/dashboard"), retry: 1, refetchInterval: 60_000 }); // also picks up maintenance windows starting or ending
  useEffect(() => {
    const es = new EventSource("/api/events");
    let opened = false;
    es.onopen = () => { if (opened) qc.invalidateQueries({ queryKey: ["dashboard"] }); opened = true; }; // resync what we missed while offline
    es.onmessage = (m) => {
      let e: { type: string; checkId?: string; status?: Status; latencyMs?: number | null; ts?: number };
      try { e = JSON.parse(m.data); } catch { return; }
      if (e.type === "config-changed") qc.invalidateQueries({ queryKey: ["dashboard"] });
      else if (e.type === "status") qc.setQueryData<DashboardDTO>(["dashboard"], (d) => d && {
        ...d,
        services: d.services.map((s) => {
          const st = s.status;
          if (!st || st.id !== e.checkId) return s;
          const changedAt = st.status !== e.status ? e.ts ?? st.changedAt : st.changedAt;
          return { ...s, status: { ...st, changedAt, status: e.status as Status, latencyMs: e.latencyMs ?? null, checkedAt: e.ts ?? null } };
        }),
      });
    };
    return () => es.close();
  }, [qc]);
  return q;
}
