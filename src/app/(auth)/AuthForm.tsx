"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/api-client";
import { BrandMark } from "@/components/BrandMark";

export function AuthForm({ mode, tokenRequired }: { mode: "login" | "setup"; tokenRequired?: boolean }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr(null);
    try {
      await api(mode === "login" ? "/api/auth/login" : "/api/setup", { method: "POST", body: { username: f.get("username"), password: f.get("password"), ...(mode === "setup" && tokenRequired ? { setupToken: f.get("setupToken") } : {}) } });
      router.replace("/"); router.refresh();
    } catch (x) {
      setErr(x instanceof ApiClientError ? x.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <BrandMark size={44} />
        <div>
          <h1 className="text-xl font-semibold">{mode === "setup" ? "Welcome to Homi" : "Sign in"}</h1>
          <p className="text-sm text-muted">{mode === "setup" ? "Create the admin account to get started." : "Enter your credentials."}</p>
        </div>
        <div><label className="label" htmlFor="username">Username</label><input id="username" name="username" className="input" autoComplete="username" required minLength={mode === "setup" ? 3 : 1} autoFocus /></div>
        <div><label className="label" htmlFor="password">Password{mode === "setup" && " (min. 10 characters)"}</label><input id="password" name="password" type="password" className="input" autoComplete={mode === "setup" ? "new-password" : "current-password"} required minLength={mode === "setup" ? 10 : 1} /></div>
        {mode === "setup" && tokenRequired && <div><label className="label" htmlFor="setupToken">Setup token</label><input id="setupToken" name="setupToken" className="input" required /></div>}
        {err && <p role="alert" className="text-sm text-down">{err}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Please wait…" : mode === "setup" ? "Create account" : "Sign in"}</button>
      </form>
    </main>
  );
}
