/** Scripted caller: replays a scenario's timed payloads through the voice code path. */
import { scenarios } from "./fixtures";
import { updateIncident } from "./voice";

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
  const scenario = scenarios[scenarioId];
  if (!scenario) return null;
  const conversationId = `scripted-${scenario.id}-${crypto.randomUUID().slice(0, 6)}`;

  const state = scriptState();
  const generation = state.generation;
  scenario.steps.forEach((step, i) => {
    const timer = setTimeout(
      () => {
        state.timers.delete(timer);
        if (generation !== state.generation) return;
        updateIncident(
          {
            conversationId,
            callerNumber: scenario.callerNumber,
            locationText: step.locationText,
            facts: step.facts,
          },
          {
            // First step carries the fixture coords (stand-in for geocoding).
            coords: i === 0 ? scenario.location.coords : undefined,
            transcript: step.transcript,
          },
        );
      },
      (step.atSeconds * 1000) / speed,
    );
    state.timers.add(timer);
  });
  return { conversationId };
}

export const scenarioIds = () => Object.keys(scenarios);
