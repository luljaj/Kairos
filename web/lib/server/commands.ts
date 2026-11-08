/**
 * Dispatcher commands. Each handler runs synchronously inside `mutate()` and
 * re-checks its preconditions against current state. See plan/02 "Commands".
 */
import {
  REQUIRED_CARE_LEVEL,
  careLevelOf,
  meetsCareLevel,
  selectability,
  type Acuity,
  type Ambulance,
  type Call,
  type Command,
  type CommandErrorCode,
  type CommandResult,
  type DispatchState,
  type Task,
} from "@/lib/contracts";
import { initialState } from "./fixtures";
import { applyIncidentChanges, createCall } from "./incidents";
import { getState, mutate, newId, rememberCommand, replaceState, seenCommand, touch } from "./store";

type HandlerOk = { queued?: boolean; createdId?: string };
type HandlerErr = { error: CommandErrorCode; message: string };
type HandlerResult = HandlerOk | HandlerErr;

const err = (error: CommandErrorCode, message: string): HandlerErr => ({ error, message });
const isErr = (r: HandlerResult): r is HandlerErr => "error" in r;

/** Idempotent entry point: a repeated commandId returns the original result. */
export function applyCommand(cmd: Command): CommandResult {
  const previous = seenCommand(cmd.commandId);
  if (previous) return previous;

  let result: CommandResult;
  if (cmd.type === "reset_demo") {
    replaceState(initialState());
    result = { ok: true, revision: getState().revision };
  } else {
    let failure: HandlerErr | null = null;
    const out = mutate((state) => {
      const r = handle(state, cmd, new Date().toISOString());
      if (isErr(r)) {
        failure = r;
        return false;
      }
      return r;
    });
    result =
      failure !== null
        ? { ok: false, ...(failure as HandlerErr) }
        : { ok: true, revision: getState().revision, ...(out || {}) };
  }

  rememberCommand(cmd.commandId, result);
  return result;
}

function handle(state: DispatchState, cmd: Exclude<Command, { type: "reset_demo" }>, now: string): HandlerResult {
  switch (cmd.type) {
    case "create_manual_call": {
      const call = createCall(state, { now, location: cmd.location, facts: cmd.facts });
      return { createdId: call.id };
    }

    case "edit_incident": {
      const call = state.calls[cmd.callId];
      if (!call) return err("not_found", `call ${cmd.callId} not found`);
      applyIncidentChanges(state, call, { location: cmd.location, facts: cmd.facts, now });
      return {};
    }

    case "override_acuity": {
      const call = state.calls[cmd.callId];
      if (!call) return err("not_found", `call ${cmd.callId} not found`);
      call.acuity = { value: cmd.acuity, source: "dispatcher", setAt: now };
      // Recompute mismatch flags on the latest set; do not re-run the model.
      const set = call.recommendationSetId ? state.recommendations[call.recommendationSetId] : null;
      if (set) {
        for (const c of set.candidates) {
          c.capabilityMismatch = !meetsCareLevel(c.careLevel, REQUIRED_CARE_LEVEL[cmd.acuity]);
        }
      }
      touch(call, now);
      return {};
    }

    case "accept_recommendation": {
      const set = state.recommendations[cmd.recommendationSetId];
      if (!set) return err("not_found", `recommendation ${cmd.recommendationSetId} not found`);
      const call = state.calls[set.callId];
      if (!call) return err("not_found", `call ${set.callId} not found`);
      if (call.recommendationSetId !== set.id || set.status === "stale") {
        return err("stale", "recommendation is out of date; a fresh one is coming");
      }
      if (set.status !== "ready") return err("conflict", `recommendation status is ${set.status}`);
      if (call.taskId) return err("conflict", "call already has a task");
      const cand = set.candidates.find((c) => c.ambulanceId === cmd.ambulanceId);
      if (!cand) return err("not_found", `ambulance ${cmd.ambulanceId} is not a candidate`);
      if (!cand.selectable) return err("not_selectable", cand.unavailableReason ?? "unit not selectable");
      if (cand.capabilityMismatch && !cmd.confirmMismatch) {
        return err("mismatch_unconfirmed", "unit care level is below what this acuity needs; confirm to send");
      }
      const amb = state.ambulances[cmd.ambulanceId];
      if (!amb) return err("not_found", `ambulance ${cmd.ambulanceId} not found`);
      const task = assign(state, call, amb, now, {
        recommendationId: set.id,
        override: cand.capabilityMismatch
          ? { reason: "capability_mismatch_confirmed", note: null }
          : cmd.ambulanceId !== set.recommendedAmbulanceId
            ? { reason: "dispatcher_choice", note: null }
            : null,
      });
      return { createdId: task.id, queued: task.status === "queued" };
    }

    case "manual_assign": {
      const call = state.calls[cmd.callId];
      if (!call) return err("not_found", `call ${cmd.callId} not found`);
      if (call.taskId) return err("conflict", "call already has a task");
      const amb = state.ambulances[cmd.ambulanceId];
      if (!amb) return err("not_found", `ambulance ${cmd.ambulanceId} not found`);
      const sel = selectability(amb, state.crew);
      if (!sel.selectable) return err("not_selectable", sel.unavailableReason ?? "unit not selectable");
      const mismatch = isMismatch(state, amb, call.acuity?.value ?? null);
      if (mismatch && !cmd.confirmMismatch) {
        return err("mismatch_unconfirmed", "unit care level is below what this acuity needs; confirm to send");
      }
      const task = assign(state, call, amb, now, {
        recommendationId: null,
        override: mismatch
          ? { reason: "capability_mismatch_confirmed", note: null }
          : { reason: "dispatcher_choice", note: null },
      });
      return { createdId: task.id, queued: task.status === "queued" };
    }

    case "cancel_task": {
      const task = state.tasks[cmd.taskId];
      if (!task) return err("not_found", `task ${cmd.taskId} not found`);
      if (task.status !== "queued" && task.status !== "active") {
        return err("conflict", `task is ${task.status}`);
      }
      const amb = state.ambulances[task.ambulanceId];
      const call = state.calls[task.callId];
      const wasActive = task.status === "active";
      task.status = "cancelled";
      task.phase = null;
      touch(task, now);
      if (call) {
        call.taskId = null;
        call.status = "awaiting_decision";
        touch(call, now);
      }
      if (amb) {
        if (wasActive) releaseUnit(state, amb, now);
        else {
          amb.queuedTaskIds = amb.queuedTaskIds.filter((id) => id !== task.id);
          touch(amb, now);
        }
      }
      fleetChanged(state);
      return {};
    }

    case "advance_phase": {
      const task = state.tasks[cmd.taskId];
      if (!task) return err("not_found", `task ${cmd.taskId} not found`);
      if (task.status !== "active") return err("conflict", `task is ${task.status}`);
      advancePhase(state, task, now);
      return {};
    }

    case "request_recommendation":
      // TODO(pipeline): lib/server/recommend.ts — candidates, model/fallback, apply.
      return err("not_implemented", "recommendation pipeline not built yet");

    case "move_queued_task":
      return err("not_implemented", "queue reordering is a stretch goal");
  }
}

// --- helpers -----------------------------------------------------------------

function isMismatch(state: DispatchState, amb: Ambulance, acuity: Acuity | null): boolean {
  if (!acuity) return false;
  return !meetsCareLevel(careLevelOf(amb, state.crew), REQUIRED_CARE_LEVEL[acuity]);
}

/** Fleet changed: open recommendation sets are stale (plan/02). */
function fleetChanged(state: DispatchState) {
  state.fleetRevision++;
  for (const set of Object.values(state.recommendations)) {
    const call = state.calls[set.callId];
    if (call && !call.taskId && set.status !== "stale") set.status = "stale";
  }
  // TODO(pipeline): re-run candidates for calls awaiting a decision (debounced).
}

/** Start the task now if the unit is free, otherwise append to its queue. */
function assign(
  state: DispatchState,
  call: Call,
  amb: Ambulance,
  now: string,
  opts: { recommendationId: string | null; override: Task["override"] },
): Task {
  const task: Task = {
    id: newId("task"),
    revision: 0,
    callId: call.id,
    ambulanceId: amb.id,
    status: "queued",
    phase: null,
    acuityAtAcceptance: call.acuity?.value ?? null,
    hospital: null,
    route: null, // TODO(routing): Mapbox route from release point to incident
    phaseEndsAt: null,
    etaAt: null,
    acceptedFromRecommendationId: opts.recommendationId,
    override: opts.override,
    createdAt: now,
    updatedAt: now,
  };
  state.tasks[task.id] = task;

  if (amb.status === "available" && !amb.activeTaskId) startTask(amb, task, now);
  else amb.queuedTaskIds.push(task.id);
  touch(amb, now);

  call.taskId = task.id;
  call.status = "assigned";
  touch(call, now);
  fleetChanged(state);
  return task;
}

function startTask(amb: Ambulance, task: Task, now: string) {
  task.status = "active";
  task.phase = "en_route";
  // TODO(sim): phaseEndsAt/etaAt from route duration and SIM_SPEED.
  touch(task, now);
  amb.status = "busy";
  amb.activeTaskId = task.id;
}

/** Unit finished or dropped its active task: start the next queued one, else free it. */
function releaseUnit(state: DispatchState, amb: Ambulance, now: string) {
  amb.activeTaskId = null;
  const nextId = amb.queuedTaskIds.shift();
  const next = nextId ? state.tasks[nextId] : undefined;
  if (next) startTask(amb, next, now);
  else amb.status = "available";
  touch(amb, now);
}

/** Demo control and (later) the sim tick's phase transition. */
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
      fleetChanged(state);
      break;
    default:
      return;
  }
  task.phaseEndsAt = null;
  touch(task, now);
  if (amb) touch(amb, now);
}

function nearestHospital(state: DispatchState, from: { lat: number; lng: number } | null) {
  if (state.hospitals.length === 0) return null;
  const d = (h: (typeof state.hospitals)[number]) =>
    from ? (h.coords.lat - from.lat) ** 2 + (h.coords.lng - from.lng) ** 2 : 0;
  const h = [...state.hospitals].sort((a, b) => d(a) - d(b))[0];
  return { name: h.name, coords: { ...h.coords } };
}
