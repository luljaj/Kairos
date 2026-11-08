/** Scripted caller: replays a scenario's timed payloads through the voice code path. */
import { scenarios } from "./fixtures";
import { ingestIncident } from "./voice";
import type { ScenarioFixture } from "@/lib/contracts";
import { randomIncidents } from "./random-incidents";
import { RANDOM_INCIDENT_OPTIONS, randomIncidentOption } from "@/lib/demo/random-incidents";

type ScriptedState = { generation: number; timers: Set<ReturnType<typeof setTimeout>> };

declare global {
  var __scriptedCalls: ScriptedState | undefined;
}

const scriptState = () => globalThis.__scriptedCalls ??= { generation: 0, timers: new Set() };

export function cancelScriptedCalls(): void {
  const state = scriptState();
  state.generation++;
  for (const timer of state.timers) clearTimeout(timer);
  state.timers.clear();
}

export function startScriptedCall(scenarioId: string, speed = 1): { conversationId: string } | null {
  if (randomIncidentOption(scenarioId)) {
    const calls = randomIncidents(scenarioId === "random-burst" ? 3 : 1)
      .map((scenario) => startScenario(scenario, speed));
    return calls[0];
  }
  const scenario = scenarios[scenarioId];
  if (!scenario) return null;
  return startScenario(scenario, speed);
}

function startScenario(scenario: ScenarioFixture, speed: number): { conversationId: string } {
  const conversationId = `scripted-${scenario.id}-${crypto.randomUUID().slice(0, 6)}`;

  const state = scriptState();
  const generation = state.generation;
  scenario.steps.forEach((step, i) => {
    const timer = setTimeout(
      () => {
        state.timers.delete(timer);
        if (generation !== state.generation) return;
        void ingestIncident(
          {
            conversationId,
            callerNumber: scenario.callerNumber,
            locationText: step.locationText,
            facts: step.facts,
            intakeComplete: i === scenario.steps.length - 1,
          },
          {
            // First step carries the fixture coords, so the demo never depends on geocoding.
            coords: i === 0 ? scenario.location.coords : undefined,
            transcript: step.transcript,
          },
        ).catch((error) => console.error("[scripted] step failed", error));
      },
      (step.atSeconds * 1000) / speed,
    );
    state.timers.add(timer);
  });
  return { conversationId };
}

export const scenarioIds = () => [...Object.keys(scenarios), ...RANDOM_INCIDENT_OPTIONS.map((item) => item.id)];
