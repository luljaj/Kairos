/** Call creation and fact merging. Shared by voice tools, dispatcher edits and the scripted caller. */
import {
  EMPTY_FACTS,
  FACT_KEYS,
  type Call,
  type CallLocation,
  type DispatchState,
  type IncidentFacts,
  type LatLng,
} from "@/lib/contracts";
import { newId, touch } from "./store";

export function createCall(
  state: DispatchState,
  init: {
    now: string;
    conversationId?: string | null;
    callerNumber?: string | null;
    location?: Partial<CallLocation>;
    facts?: Partial<IncidentFacts>;
  },
): Call {
  const call: Call = {
    id: newId("call"),
    revision: 0,
    conversationId: init.conversationId ?? null,
    callerNumber: init.callerNumber ?? null,
    status: "intake",
    location: { text: null, coords: null, confidence: null },
    facts: { ...EMPTY_FACTS },
    factsRevision: 0,
    summary: null,
    acuity: null,
    recommendationSetId: null,
    taskId: null,
    transcript: [],
    createdAt: init.now,
    updatedAt: init.now,
  };
  state.calls[call.id] = call;
  applyIncidentChanges(state, call, { location: init.location, facts: init.facts, now: init.now });
  return call;
}

export function findCallByConversation(state: DispatchState, conversationId: string): Call | undefined {
  return Object.values(state.calls).find((c) => c.conversationId === conversationId);
}

const sameCoords = (a: LatLng | null, b: LatLng | null) =>
  a === b || (a !== null && b !== null && a.lat === b.lat && a.lng === b.lng);

/**
 * Merge a partial update. Omitted keys are left alone; explicit `null` sets unknown.
 * Bumps `factsRevision` only when a fact or `location.coords` actually changes
 * and marks the latest recommendation stale on any input change.
 */
export function applyIncidentChanges(
  state: DispatchState,
  call: Call,
  changes: { location?: Partial<CallLocation>; facts?: Partial<IncidentFacts>; now: string },
): boolean {
  let changed = false;
  let factsChanged = false;

  for (const key of FACT_KEYS) {
    if (!changes.facts || !(key in changes.facts)) continue;
    const next = changes.facts[key];
    if (next === undefined || call.facts[key] === next) continue;
    (call.facts as Record<string, unknown>)[key] = next;
    changed = factsChanged = true;
  }

  const loc = changes.location;
  if (loc) {
    if (loc.text !== undefined && loc.text !== call.location.text) {
      call.location.text = loc.text;
      changed = true;
    }
    if (loc.confidence !== undefined && loc.confidence !== call.location.confidence) {
      call.location.confidence = loc.confidence;
      changed = true;
    }
    if (loc.coords !== undefined && !sameCoords(loc.coords, call.location.coords)) {
      call.location.coords = loc.coords;
      changed = factsChanged = true;
      const task = call.taskId ? state.tasks[call.taskId] : null;
      if (task?.status === "active" && task.phase === "en_route") {
        task.route = null;
        task.phaseEndsAt = null;
        task.etaAt = null;
        touch(task, changes.now);
      }
      // An assigned incident is also a route waypoint for other calls' ETAs.
      if (task?.status === "active" || task?.status === "queued") fleetChanged(state);
    }
  }

  if (factsChanged) call.factsRevision++;
  if (changed) {
    markRecommendationStale(state, call);
    touch(call, changes.now);
  }
  return changed;
}

export function appendTranscript(
  call: Call,
  entries: { role: "agent" | "caller"; text: string }[],
  now: string,
): void {
  if (entries.length === 0) return;
  for (const e of entries) call.transcript.push({ ...e, at: now });
  touch(call, now);
}

export function markRecommendationStale(state: DispatchState, call: Call): boolean {
  const latest = call.recommendationSetId ? state.recommendations[call.recommendationSetId] : null;
  if (!latest || latest.status === "stale") return false;
  latest.status = "stale";
  return true;
}

/** Invalidate open recommendations whose fleet estimates need a refresh. */
export function fleetChanged(state: DispatchState): void {
  state.fleetRevision++;
  for (const call of Object.values(state.calls)) {
    if (!call.taskId && call.status !== "closed") markRecommendationStale(state, call);
  }
}
