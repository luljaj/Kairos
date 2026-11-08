import { z } from "zod";
import { scenarioIds, startScriptedCall } from "@/lib/server/scripted";

const Body = z.object({ scenario: z.string(), speed: z.number().positive().max(20).optional() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "invalid", scenarios: scenarioIds() }, { status: 400 });
  const started = startScriptedCall(parsed.data.scenario, parsed.data.speed);
  if (!started) return Response.json({ ok: false, error: "not_found", scenarios: scenarioIds() }, { status: 404 });
  return Response.json({ ok: true, ...started });
}
