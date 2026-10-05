import { type NextRequest } from "next/server";
import { getViewer } from "@/server/api";
import { hub, type HomiEvent } from "@/server/events/hub";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(req: NextRequest) {
  const viewer = getViewer(req);
  if (viewer.kind === "anon") return new Response("Unauthorized", { status: 401 });
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(ctl) {
      const send = (e: unknown) => ctl.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      const on = (e: HomiEvent) => send(e);
      hub.on("event", on);
      const ka = setInterval(() => ctl.enqueue(enc.encode(": ka\n\n")), 20_000);
      cleanup = () => { hub.off("event", on); clearInterval(ka); };
      req.signal.addEventListener("abort", () => { cleanup(); try { ctl.close(); } catch {} });
      ctl.enqueue(enc.encode("retry: 3000\n\n"));
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
}
