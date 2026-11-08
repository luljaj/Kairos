/**
 * Dispatcher commands. Each handler runs synchronously inside `mutate()` and
 * re-checks its preconditions against current state. See plan/02 "Commands".
 */
import {
  IsoTime,
  careLevelOf,
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
import { advancePhase, releaseUnit, startTask } from "./task-lifecycle";
export { advancePhase } from "./task-lifecycle";
import { ensureSimulationStarted, resetSimulation } from "./simulation";
import { initialState } from "./fixtures";
import { applyIncidentChanges, createCall, fleetChanged, markRecommendationStale } from "./incidents";
import { capabilityMismatch, incidentInputKey, sortForDisplay } from "./candidates";
import { estimateArrival } from "./eta";
import {
  cancelCallRecommendation, ensureRecommendationsStarted, resetRecommendations,
  scheduleAwaitingRecommendations, scheduleRecommendation,
} from "./recommend";
import { cancelScriptedCalls } from "./scripted";
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

  const state = getState();
  const beforeFleet = state.fleetRevision;
  const editedCall = cmd.type === "edit_incident" ? state.calls[cmd.callId] : null;
  const beforeIncident = editedCall ? incidentInputKey(editedCall) : null;
  let result: CommandResult;
  if (cmd.type === "reset_demo") {
    resetSimulation();
    resetRecommendations();
    cancelScriptedCalls();
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
  if (!result.ok) return result;

  ensureSimulationStarted();
  ensureRecommendationsStarted();
  switch (cmd.type) {
    case "create_manual_call":
      if (result.createdId) scheduleRecommendation(result.createdId);
      break;
    case "edit_incident":
      if (editedCall && beforeIncident !== incidentInputKey(editedCall)) scheduleRecommendation(editedCall.id);
      break;
    case "request_recommendation":
      scheduleRecommendation(cmd.callId, { immediate: true });
      break;
    case "accept_recommendation":
    case "manual_assign":
      if (result.createdId) cancelCallRecommendation(state.tasks[result.createdId].callId);
      break;
    case "cancel_task":
      cancelCallRecommendation(state.tasks[cmd.taskId].callId);
      break;
    case "advance_phase":
      if (state.tasks[cmd.taskId].status === "completed") {
        cancelCallRecommendation(state.tasks[cmd.taskId].callId);
      }
      break;
  }
  if (state.fleetRevision !== beforeFleet) scheduleAwaitingRecommendations();
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
          c.capabilityMismatch = capabilityMismatch(c.careLevel, cmd.acuity);
        }
        set.candidates = sortForDisplay(set.candidates);
      }
      touch(call, now);
      return {};
    }

    case "accept_recommendation": {
      const set = state.recommendations[cmd.recommendationSetId];
      if (!set) return err("not_found", `recommendation ${cmd.recommendationSetId} not found`);
      const call = state.calls[set.callId];
      if (!call) return err("not_found", `call ${set.callId} not found`);
      if (call.taskId || call.status === "closed") return err("conflict", "call is closed or already assigned");
      if (call.recommendationSetId !== set.id || set.status === "stale"
          || set.factsRevision !== call.factsRevision || set.fleetRevision !== state.fleetRevision) {
        return err("stale", "recommendation is out of date; a fresh one is coming");
      }
      if (set.status !== "ready") return err("conflict", `recommendation status is ${set.status}`);
      const cand = set.candidates.find((c) => c.ambulanceId === cmd.ambulanceId);
      if (!cand) return err("not_found", `ambulance ${cmd.ambulanceId} is not a candidate`);
      if (!cand.selectable) return err("not_selectable", cand.unavailableReason ?? "unit not selectable");
      const amb = state.ambulances[cmd.ambulanceId];
      if (!amb) return err("not_found", `ambulance ${cmd.ambulanceId} not found`);
      const sel = selectability(amb, state.crew);
      if (!sel.selectable) return err("not_selectable", sel.unavailableReason ?? "unit not selectable");
      const mismatch = isMismatch(state, amb, call.acuity?.value ?? set.acuity);
      if (mismatch && !cmd.confirmMismatch) {
        return err("mismatch_unconfirmed", "unit care level is below what this acuity needs; confirm to send");
      }
      const task = assign(state, call, amb, now, {
        etaAt: assignmentEta(state, call, amb),
        recommendationId: set.id,
        override: mismatch
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
      if (call.taskId || call.status === "closed") return err("conflict", "call is closed or already assigned");
      const amb = state.ambulances[cmd.ambulanceId];
      if (!amb) return err("not_found", `ambulance ${cmd.ambulanceId} not found`);
      const sel = selectability(amb, state.crew);
      if (!sel.selectable) return err("not_selectable", sel.unavailableReason ?? "unit not selectable");
      const mismatch = isMismatch(state, amb, call.acuity?.value ?? null);
      if (mismatch && !cmd.confirmMismatch) {
        return err("mismatch_unconfirmed", "unit care level is below what this acuity needs; confirm to send");
      }
      const task = assign(state, call, amb, now, {
        etaAt: assignmentEta(state, call, amb),
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

    case "request_recommendation": {
      const call = state.calls[cmd.callId];
      if (!call) return err("not_found", `call ${cmd.callId} not found`);
      if (call.status === "closed") return err("conflict", "call is closed");
      markRecommendationStale(state, call);
      return {};
    }

    case "move_queued_task":
      return err("not_implemented", "queue reordering is a stretch goal");
  }
}

// --- helpers -----------------------------------------------------------------

function isMismatch(state: DispatchState, amb: Ambulance, acuity: Acuity | null): boolean {
  return capabilityMismatch(careLevelOf(amb, state.crew), acuity);
}

function assignmentEta(state: DispatchState, call: Call, ambulance: Ambulance): string | null {
  const { arrivalInSeconds } = estimateArrival(state, ambulance, call.location.coords);
  if (arrivalInSeconds === null) return null;
  const arrival = new Date(Date.parse(state.simClock) + arrivalInSeconds * 1000);
  if (!Number.isFinite(arrival.getTime())) return null;
  return IsoTime.safeParse(arrival.toISOString()).data ?? null;
}

/** Start the task now if the unit is free, otherwise append to its queue. */
function assign(
  state: DispatchState,
  call: Call,
  amb: Ambulance,
  now: string,
  opts: { etaAt: string | null; recommendationId: string | null; override: Task["override"] },
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
    route: null, // The simulation requests a route when the task becomes active.
    phaseEndsAt: null,
    etaAt: opts.etaAt,
    acceptedFromRecommendationId: opts.recommendationId,
    override: opts.override,
    createdAt: now,
    updatedAt: now,
  };
  state.tasks[task.id] = task;

  if (amb.status === "available" && !amb.activeTaskId && amb.queuedTaskIds.length === 0) {
    startTask(amb, task, now);
  } else {
    amb.queuedTaskIds.push(task.id);
  }
  touch(amb, now);

  call.taskId = task.id;
  call.status = "assigned";
  touch(call, now);
  fleetChanged(state);
  return task;
}
