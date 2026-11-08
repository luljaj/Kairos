import {
  FACT_KEYS, ModelRequest, REQUIRED_CARE_LEVEL, careLevelOf, meetsCareLevel, selectability,
  type Acuity, type Call, type Candidate, type DispatchState, type LatLng,
} from "@/lib/contracts";
import { estimateArrival } from "./eta";

const compareId = (a: string, b: string) => a < b ? -1 : Number(a > b);

type Arrival = Pick<Candidate, "arrivalInSeconds" | "ambulanceId">;

export function compareArrival(a: Arrival, b: Arrival): number {
  return (a.arrivalInSeconds ?? Infinity) - (b.arrivalInSeconds ?? Infinity)
    || compareId(a.ambulanceId, b.ambulanceId);
}

export function sortForDisplay(candidates: Candidate[]): Candidate[] {
  const group = (c: Candidate) => !c.selectable ? 2 : Number(c.capabilityMismatch);
  return [...candidates].sort((a, b) => group(a) - group(b) || compareArrival(a, b));
}

export function capabilityMismatch(care: Candidate["careLevel"], acuity: Acuity | null): boolean {
  return acuity !== null && !meetsCareLevel(care, REQUIRED_CARE_LEVEL[acuity]);
}

export function buildCandidates(state: DispatchState, call: Call): Candidate[] {
  return sortForDisplay(Object.values(state.ambulances).map((ambulance) => {
    const careLevel = careLevelOf(ambulance, state.crew);
    return {
      ambulanceId: ambulance.id,
      ...estimateArrival(state, ambulance, call.location.coords),
      careLevel,
      ...selectability(ambulance, state.crew),
      capabilityMismatch: capabilityMismatch(careLevel, call.acuity?.value ?? null),
      crewSuitable: null,
      reason: null,
    };
  }));
}

export function buildModelRequest(
  state: DispatchState, call: Call, candidates: Candidate[], requestId: string,
): ModelRequest {
  return ModelRequest.parse({
    requestId,
    incident: {
      location: { text: call.location.text, confidence: call.location.confidence },
      facts: call.facts,
    },
    candidates: candidates.filter((c) => c.selectable).sort(compareArrival).map((c) => ({
      ambulanceId: c.ambulanceId,
      careLevel: c.careLevel,
      crew: state.ambulances[c.ambulanceId].crewIds.flatMap((id) => {
        const member = state.crew[id];
        return member ? [{
          role: member.role, qualifications: member.qualifications, monthsOfService: member.monthsOfService,
        }] : [];
      }),
      availableInSeconds: c.availableInSeconds,
      travelSeconds: c.travelSeconds,
      arrivalInSeconds: c.arrivalInSeconds,
    })),
  });
}

const pointKey = (point: LatLng | null | undefined) => point ? [point.lat, point.lng] : null;

export function incidentInputKey(call: Call): string {
  return JSON.stringify([
    FACT_KEYS.map((key) => call.facts[key] ?? null),
    call.location.text, call.location.confidence, pointKey(call.location.coords),
  ]);
}

export function fleetInputKey(state: DispatchState): string {
  const byId = <T extends { id: string }>(items: T[]) => items.sort((a, b) => compareId(a.id, b.id));
  const units = byId(Object.values(state.ambulances));
  const workIds = new Set(units.flatMap((unit) =>
    unit.activeTaskId ? [unit.activeTaskId, ...unit.queuedTaskIds] : unit.queuedTaskIds,
  ));
  return JSON.stringify([
    units.map((a) => {
      const task = a.activeTaskId ? state.tasks[a.activeTaskId] : null;
      // Progress along an already-timed route must not discard every in-flight model result.
      // Its deadline, destination and queue below define this unit's availability.
      const moving = (task?.status === "active" && task.route && task.phaseEndsAt)
        || (a.returnTrip?.route && a.returnTrip.endsAt);
      return [a.id, a.status, moving ? null : pointKey(a.position), a.crewIds, a.activeTaskId, a.queuedTaskIds,
        a.returnTrip?.endsAt ?? null, a.returnTrip ? pointKey(a.homeStation) : null];
    }),
    byId(Object.values(state.crew)).map((c) => [c.id, c.role, c.qualifications, c.monthsOfService]),
    [...workIds].sort().map((id) => {
      const task = state.tasks[id];
      return task ? [
        id, task.ambulanceId, task.callId, task.status, task.phase, task.phaseEndsAt,
        task.route?.durationSeconds ?? null, pointKey(task.hospital?.coords),
        pointKey(state.calls[task.callId]?.location.coords),
      ] : [id];
    }),
    byId([...state.hospitals]).map((h) => [h.id, pointKey(h.coords)]),
  ]);
}
