import { NextResponse } from "next/server";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";

export const dynamic = "force-dynamic";
export function GET() {
  try { getDb().select().from(users).limit(1).all(); return NextResponse.json({ ok: true, version: process.env.npm_package_version ?? "0.1.0", db: "ok" }); }
  catch { return NextResponse.json({ ok: false, db: "error" }, { status: 503 }); }
}
