import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z, type ZodType } from "zod";
import { COOKIE, lookupSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { getSetting } from "@/server/settings";

export type Viewer = { kind: "admin"; user: { id: string; username: string }; sessionId: string } | { kind: "public" } | { kind: "anon" };

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: unknown) { super(message); }
}

export { getSetting };

export function getViewer(req: Pick<NextRequest, "cookies">): Viewer {
  const s = lookupSession(req.cookies.get(COOKIE)?.value);
  if (s) return { kind: "admin", user: s.user, sessionId: s.sessionId };
  return getSetting("publicView", false) ? { kind: "public" } : { kind: "anon" };
}

function originOk(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients (curl); cookie+SameSite still protect browsers
  const allowed = process.env.HOMI_PUBLIC_URL ? new URL(process.env.HOMI_PUBLIC_URL).host : req.headers.get("host");
  try { return new URL(origin).host === allowed; } catch { return false; }
}

export type Auth = "admin" | "public" | "none";
interface Opts<B> { auth: Auth; body?: ZodType<B> }
type Ctx = { params: Promise<Record<string, string>> };

export function route<B = undefined>(opts: Opts<B>, handler: (a: { req: NextRequest; viewer: Viewer; body: B; params: Record<string, string> }) => Promise<unknown> | unknown) {
  return async (req: NextRequest, ctx: Ctx = { params: Promise.resolve({}) }) => {
    try {
      const mutating = !["GET", "HEAD", "OPTIONS"].includes(req.method);
      if (mutating && !originOk(req)) throw new ApiError(403, "bad_origin", "Cross-origin request rejected");
      const viewer = getViewer(req);
      if (opts.auth === "admin" && viewer.kind !== "admin") throw new ApiError(401, "unauthorized", "Sign in required");
      if (opts.auth === "public" && viewer.kind === "anon") throw new ApiError(401, "unauthorized", "Sign in required");
      let body = undefined as B;
      if (opts.body) {
        if (!(req.headers.get("content-type") ?? "").includes("application/json")) throw new ApiError(415, "unsupported_media_type", "Expected application/json");
        const parsed = opts.body.safeParse(await req.json().catch(() => undefined));
        if (!parsed.success) throw new ApiError(400, "invalid_body", "Invalid request", z.flattenError(parsed.error).fieldErrors);
        body = parsed.data;
      }
      const out = await handler({ req, viewer, body, params: await ctx.params });
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: { code: e.code, message: e.message, fields: e.fields } }, { status: e.status });
      console.error("[homi] unhandled API error", e);
      return NextResponse.json({ error: { code: "internal", message: "Internal error" } }, { status: 500 });
    }
  };
}

export const audit = async (actor: string, action: string, detail?: unknown) => {
  const { auditLog } = await import("@/server/db/schema");
  getDb().insert(auditLog).values({ ts: Date.now(), actor, action, detail: detail ?? null }).run();
};

export const clientIp = (req: NextRequest) =>
  (process.env.HOMI_TRUST_PROXY === "1" ? req.headers.get("x-forwarded-for")?.split(",")[0].trim() : null) ?? "local";

export const isSecure = (req: NextRequest) =>
  req.nextUrl.protocol === "https:" || (process.env.HOMI_TRUST_PROXY === "1" && req.headers.get("x-forwarded-proto") === "https");
