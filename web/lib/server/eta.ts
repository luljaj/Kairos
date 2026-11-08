import { selectability, type Ambulance, type DispatchState, type LatLng, type Task } from "@/lib/contracts";

const SCENE_SECONDS = 480;
type Travel = (from: LatLng, to: LatLng) => number;

function distance(from: LatLng, to: LatLng): number {
  const rad = Math.PI / 180;
  const h = Math.sin((to.lat - from.lat) * rad / 2) ** 2
    + Math.cos(from.lat * rad) * Math.cos(to.lat * rad)
      * Math.sin((to.lng - from.lng) * rad / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function estimateTravelSeconds(from: LatLng, to: LatLng): number {
  return Math.ceil(distance(from, to) * 1.4 / (40_000 / 3_600));
}

export function nearestHospital(state: DispatchState, from: LatLng | null) {
  if (!from) return null;
  const hospital = [...state.hospitals].sort((a, b) =>
    distance(from, a.coords) - distance(from, b.coords) || (a.id < b.id ? -1 : Number(a.id > b.id)),
  )[0];
  return hospital ? { name: hospital.name, coords: { ...hospital.coords } } : null;
}

const duration = (seconds: number): number | null =>
  Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
const unknown = () => ({ availableInSeconds: null, releasePoint: null });
function inconsistent(category: string) {
  console.warn(`[eta] ${category}`);
  return unknown();
}

function workLocations(state: DispatchState, task: Task) {
  const incident = state.calls[task.callId]?.location.coords ?? null;
  return { incident, hospital: (task.hospital ?? nearestHospital(state, incident))?.coords ?? null };
}

export function estimateAvailability(
  state: DispatchState,
  ambulance: Ambulance,
  travel: Travel = estimateTravelSeconds,
): { availableInSeconds: number | null; releasePoint: LatLng | null } {
  if (!selectability(ambulance, state.crew).selectable) return unknown();

  let seconds = 0;
  let releasePoint = ambulance.position;
  const seen = new Set<string>();
  if (ambulance.activeTaskId) {
    const task = state.tasks[ambulance.activeTaskId];
    if (!task || task.ambulanceId !== ambulance.id || task.status !== "active"
        || !task.phase || task.phase === "completed") {
      return inconsistent("invalid active task");
    }
    seen.add(task.id);
    const { incident, hospital } = workLocations(state, task);
    if (!hospital) return unknown();
    const remaining = task.phaseEndsAt
      ? duration(Math.max(0, (Date.parse(task.phaseEndsAt) - Date.parse(state.simClock)) / 1000))
      : null;
    // Legacy work without a deadline uses the full current phase as an approximation.
    if (task.phase === "transporting") {
      const leg = remaining ?? duration(task.route?.durationSeconds ?? travel(releasePoint, hospital));
      if (leg === null) return unknown();
      seconds = leg;
    } else {
      if (!incident) return unknown();
      const transport = duration(travel(incident, hospital));
      const phase = task.phase === "on_scene"
        ? remaining ?? SCENE_SECONDS
        : remaining ?? duration(task.route?.durationSeconds ?? travel(releasePoint, incident));
      if (transport === null || phase === null) return unknown();
      seconds = phase + transport + (task.phase === "en_route" ? SCENE_SECONDS : 0);
    }
    releasePoint = hospital;
  }

  let hasWork = seen.size > 0;
  for (const id of ambulance.queuedTaskIds) {
    const task = state.tasks[id];
    if (!task || seen.has(id) || task.ambulanceId !== ambulance.id) {
      return inconsistent("invalid queue reference");
    }
    seen.add(id);
    if (task.status === "completed" || task.status === "cancelled") continue;
    if (task.status !== "queued") return inconsistent("invalid queued task");
    const { incident, hospital } = workLocations(state, task);
    if (!incident || !hospital) return unknown();
    const outbound = duration(travel(releasePoint, incident));
    const transport = duration(travel(incident, hospital));
    if (outbound === null || transport === null) return unknown();
    seconds += outbound + SCENE_SECONDS + transport;
    releasePoint = hospital;
    hasWork = true;
  }
  if (!hasWork && ambulance.status !== "available") return inconsistent("busy unit without work");
  const availableInSeconds = duration(seconds);
  return availableInSeconds === null ? unknown() : { availableInSeconds, releasePoint };
}

export function estimateArrival(
  state: DispatchState, ambulance: Ambulance, incident: LatLng | null,
  travel: Travel = estimateTravelSeconds,
) {
  const { availableInSeconds, releasePoint } = estimateAvailability(state, ambulance, travel);
  const travelSeconds = incident && releasePoint ? duration(travel(releasePoint, incident)) : null;
  const arrivalInSeconds = availableInSeconds !== null && travelSeconds !== null
    ? duration(availableInSeconds + travelSeconds) : null;
  return { availableInSeconds, travelSeconds, arrivalInSeconds };
}
