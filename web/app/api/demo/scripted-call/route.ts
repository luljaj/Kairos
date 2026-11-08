import { z } from "zod";
import { scenarioIds, startScriptedCall } from "@/lib/server/scripted";
import { FLEET_DEMO_SCENARIOS, fleetDemoScenario } from "@/lib/demo/scenarios";
import { buildFleetDemo } from "@/lib/server/demo-fleet";
import { applyCommand } from "@/lib/server/commands";
import { replaceState } from "@/lib/server/store";
import { ensureSimulationStarted } from "@/lib/server/simulation";

const Body = z.object({ scenario: z.string(), speed: z.number().positive().max(20).optional() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const available = [...scenarioIds(), ...FLEET_DEMO_SCENARIOS.map((item) => item.id)];
  if (!parsed.success) return Response.json({ ok: false, error: "invalid", scenarios: available }, { status: 400 });
  const preset = fleetDemoScenario(parsed.data.scenario);
  if (preset) {
    const snapshot = buildFleetDemo(preset.id)!;
    // Reuse Clear's cancellation path, including delayed intake and route work.
    applyCommand({ commandId: crypto.randomUUID(), type: "reset_demo" });
    replaceState(snapshot);
    ensureSimulationStarted(1); // Judge demos run in real time until Clear.
  }
  const started = startScriptedCall(preset?.intake ?? parsed.data.scenario, parsed.data.speed);
  if (!started) return Response.json({ ok: false, error: "not_found", scenarios: available }, { status: 404 });
  return Response.json({ ok: true, ...started });
}
