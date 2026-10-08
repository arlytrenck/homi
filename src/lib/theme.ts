"use client";
import { api } from "./api-client";

export const isDark = () => document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);

/** Flips light/dark, remembers it in a cookie (so the server can render it) and, for admins, in settings. */
export function toggleTheme(admin: boolean): "light" | "dark" {
  const next = isDark() ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  document.cookie = `homi_theme=${next}; path=/; max-age=31536000; samesite=lax`;
  if (admin) api("/api/settings", { method: "PATCH", body: { theme: next } }).catch(() => {});
  window.dispatchEvent(new CustomEvent("homi-theme", { detail: next }));
  return next;
}
