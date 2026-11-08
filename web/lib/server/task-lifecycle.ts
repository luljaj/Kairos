import type { Ambulance, DispatchState, Task } from "@/lib/contracts";
import { nearestHospital } from "./eta";
import { fleetChanged } from "./incidents";
import { touch } from "./store";

export function startTask(amb: Ambulance, task: Task, now: string) {
  amb.returnTrip = null;
  task.status = "active";
  task.phase = "en_route";
  task.phaseEndsAt = null;
  task.route = null;
  touch(task, now);
  amb.status = "busy";
  amb.activeTaskId = task.id;
}

/** Unit finished or dropped its active task: start the next queued one, else send it home while available. */
export function releaseUnit(state: DispatchState, amb: Ambulance, now: string) {
  amb.activeTaskId = null;
  const nextId = amb.queuedTaskIds.shift();
  const next = nextId ? state.tasks[nextId] : undefined;
  if (next) startTask(amb, next, now);
  else {
    amb.status = "available";
    amb.returnTrip = amb.position.lat === amb.homeStation.lat && amb.position.lng === amb.homeStation.lng
      ? null : { route: null, endsAt: null };
  }
  touch(amb, now);
}

/** Shared phase transition for the demo controls and simulation tick. */
export function advancePhase(state: DispatchState, task: Task, now: string) {
  const amb = state.ambulances[task.ambulanceId];
  const call = state.calls[task.callId];
  switch (task.phase) {
    case "en_route":
      task.phase = "on_scene";
      if (amb && call?.location.coords) amb.position = { ...call.location.coords };
      break;
    case "on_scene":
      task.phase = "transporting";
      task.hospital ??= nearestHospital(state, call?.location.coords ?? amb?.position ?? null);
      break;
    case "transporting":
      task.phase = "completed";
      task.status = "completed";
      if (amb && task.hospital) amb.position = { ...task.hospital.coords };
      if (call) {
        call.status = "closed";
        touch(call, now);
      }
      if (amb) releaseUnit(state, amb, now);
      break;
    default:
      return;
  }
  task.phaseEndsAt = null;
  task.route = null; // The previous phase route no longer describes the current leg.
  touch(task, now);
  if (amb) touch(amb, now);
  fleetChanged(state);
}
