/** Scripted caller: replays a scenario's timed payloads through the voice code path. */
import { scenarios } from "./fixtures";
import { updateIncident } from "./voice";

export function startScriptedCall(scenarioId: string, speed = 1): { conversationId: string } | null {
  const scenario = scenarios[scenarioId];
  if (!scenario) return null;
  const conversationId = `scripted-${scenario.id}-${crypto.randomUUID().slice(0, 6)}`;

  scenario.steps.forEach((step, i) => {
    setTimeout(
      () => {
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
  });
  return { conversationId };
}

export const scenarioIds = () => Object.keys(scenarios);
