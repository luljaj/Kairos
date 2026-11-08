/** SSE: full state snapshot on connect and after every change (throttled to 10/s). */
import { connection } from "next/server";
import { ensureRecommendationsStarted } from "@/lib/server/recommend";
import { getState, subscribe } from "@/lib/server/store";
import { ensureSimulationStarted } from "@/lib/server/simulation";

const MIN_INTERVAL_MS = 100;
const PING_MS = 15_000;

export async function GET(req: Request) {
  await connection(); // opt out of prerendering (Cache Components)
  ensureSimulationStarted();
  ensureRecommendationsStarted();
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let lastSent = 0;
      let pending: ReturnType<typeof setTimeout> | null = null;
      let closed = false;

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const sendNow = () => {
        pending = null;
        lastSent = Date.now();
        const state = getState();
        write(`event: state\nid: ${state.revision}\ndata: ${JSON.stringify(state)}\n\n`);
      };
      const schedule = () => {
        if (pending) return;
        const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastSent));
        pending = setTimeout(sendNow, wait);
      };

      write("retry: 1000\n\n");
      sendNow();
      const unsubscribe = subscribe(schedule);
      const ping = setInterval(() => write(": ping\n\n"), PING_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(ping);
        if (pending) clearTimeout(pending);
        try {
          controller.close();
        } catch {}
      };
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
