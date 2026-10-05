import { NextResponse } from "next/server";
import { route } from "@/server/api";
import { COOKIE, destroySession } from "@/server/auth/session";

export const dynamic = "force-dynamic";
export const POST = route({ auth: "none" }, ({ req }) => {
  const t = req.cookies.get(COOKIE)?.value;
  if (t) destroySession(t);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
});
