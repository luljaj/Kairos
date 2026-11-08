import { DispatchState, FleetFixture, ScenarioFixture } from "@/lib/contracts";
import fleetJson from "@/fixtures/fleet.json";
import busyFirstCall from "@/fixtures/scenarios/busy-first-call.json";
import fallUnconscious from "@/fixtures/scenarios/fall-unconscious.json";
import breathingCharlie from "@/fixtures/scenarios/breathing-charlie.json";
import crewExperience from "@/fixtures/scenarios/crew-experience.json";
import premadeIncidents from "@/fixtures/scenarios/premade-incidents.json";

export const fleetFixture: FleetFixture = FleetFixture.parse(fleetJson);

export const scenarios: Record<string, ScenarioFixture> = Object.fromEntries(
  [busyFirstCall, fallUnconscious, breathingCharlie, crewExperience, ...premadeIncidents].map((s) => {
    const parsed = ScenarioFixture.parse(s);
    return [parsed.id, parsed];
  }),
);

const byId = <T extends { id: string }>(xs: T[]): Record<string, T> =>
  Object.fromEntries(xs.map((x) => [x.id, structuredClone(x)]));

/** Fresh state: fixture fleet, no calls/tasks/recommendations. */
export function initialState(now = new Date()): DispatchState {
  return {
    revision: 0,
    fleetRevision: 0,
    simClock: now.toISOString(),
    calls: {},
    ambulances: byId(fleetFixture.ambulances),
    crew: byId(fleetFixture.crew),
    tasks: {},
    recommendations: {},
    hospitals: structuredClone(fleetFixture.hospitals),
  };
}
