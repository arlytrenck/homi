"use client";
import { createContext, useContext, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DialogsProvider } from "./Dialogs";
import { CommandPalette } from "./CommandPalette";

const ViewerCtx = createContext<"admin" | "public">("public");
export const useViewer = () => useContext(ViewerCtx);

export function Providers({ viewer, children }: { viewer: "admin" | "public"; children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true } } }));
  return <ViewerCtx.Provider value={viewer}><QueryClientProvider client={qc}><DialogsProvider>{children}<CommandPalette /></DialogsProvider></QueryClientProvider></ViewerCtx.Provider>;
}
