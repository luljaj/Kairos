/**
 * Voice-agent tools (webhook + MCP). Every intake source goes through `ingestIncident`:
 * geocode the location text, pre-fetch road routes, then apply the update.
 */
import type { GetAssignmentResult, LatLng, UpdateIncidentBody } from "@/lib/contracts";
import { TOOL_SECRET_HEADER } from "@/lib/contracts";
import { appendTranscript, applyIncidentChanges, createCall, findCallByConversation } from "./incidents";
import { incidentInputKey } from "./candidates";
import { ensureRecommendationsStarted, scheduleAwaitingRecommendations, scheduleRecommendation } from "./recommend";
import { geocodeLocation } from "./geocode";
import { warmRoutes } from "./routing";
import { getState, mutate, touch } from "./store";

/** Constant-time-ish check of the shared secret. Unset secret = reject everything. */
export function checkToolSecret(req: Request): boolean {
  const expected = process.env.VOICE_TOOL_SECRET;
  const got = req.headers.get(TOOL_SECRET_HEADER);
  if (!expected || !got || got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

type Extra = {
  /** Known coordinates (scripted caller). Skips geocoding. */
  coords?: LatLng | null;
  coordsConfidence?: "confirmed" | "approximate";
  transcript?: { role: "agent" | "caller"; text: string }[];
};

/** Async intake: resolve `locationText` to coords and warm routes before the update lands. */
export async function ingestIncident(body: UpdateIncidentBody, extra: Extra = {}): Promise<string> {
  let { coords, coordsConfidence } = extra;
  const previous = findCallByConversation(getState(), body.conversationId)?.location.text ?? null;
  if (coords === undefined && body.locationText !== undefined && body.locationText !== previous) {
    const geo = body.locationText ? await geocodeLocation(body.locationText) : null;
    // No usable match clears old coords, so the recommendation asks for the location again.
    coords = geo?.coords ?? null;
    coordsConfidence = geo?.confidence;
  }
  if (coords) await warmRoutes(getState(), coords);
  return updateIncident(body, { ...extra, coords, coordsConfidence });
}

export function updateIncident(body: UpdateIncidentBody, extra?: Extra): string {
  const beforeFleet = getState().fleetRevision;
  const result = mutate((state) => {
    const now = new Date().toISOString();
    let call = findCallByConversation(state, body.conversationId);
    const before = call ? incidentInputKey(call) : null;
    if (!call) {
      call = createCall(state, {
        now,
        conversationId: body.conversationId,
        callerNumber: body.callerNumber ?? null,
      });
      call.intakeComplete = false;
    } else if (body.callerNumber && !call.callerNumber) {
      call.callerNumber = body.callerNumber;
    }
    const completed = body.intakeComplete === true && call.intakeComplete === false;
    if (body.intakeComplete !== undefined && body.intakeComplete !== call.intakeComplete) {
      call.intakeComplete = body.intakeComplete;
      touch(call, now);
    }
    applyIncidentChanges(state, call, {
      now,
      facts: body.facts,
      location:
        body.locationText !== undefined || extra?.coords !== undefined
          ? {
              ...(body.locationText !== undefined
                ? { text: body.locationText, confidence: body.locationText ? "approximate" : null }
                : {}),
              ...(extra?.coords !== undefined
                ? {
                    coords: extra.coords,
                    confidence: extra.coords
                      ? extra.coordsConfidence ?? "confirmed"
                      : body.locationText ? "approximate" : null,
                  }
                : {}),
            }
          : undefined,
    });
    if (extra?.transcript) appendTranscript(call, extra.transcript, now);
    return { id: call.id, changed: completed || before !== incidentInputKey(call) };
  });
  if (result === false) throw new Error("unreachable: updateIncident always mutates");
  ensureRecommendationsStarted();
  if (getState().fleetRevision !== beforeFleet) scheduleAwaitingRecommendations();
  else if (result.changed) scheduleRecommendation(result.id);
  return result.id;
}

export function getAssignment(conversationId: string): GetAssignmentResult {
  ensureRecommendationsStarted();
  const state = getState();
  const call = findCallByConversation(state, conversationId);
  const task = call?.taskId ? state.tasks[call.taskId] : undefined;
  if (!call || !task || task.status === "cancelled") {
    const latest = call?.recommendationSetId ? state.recommendations[call.recommendationSetId] : undefined;
    if (latest?.status === "needs_more_info" && latest.missingFields.length > 0) {
      return {
        state: "pending",
        sayHint: "Help is being arranged. I need a couple more details.",
        missingFields: latest.missingFields,
      };
    }
    return { state: "pending", sayHint: "A dispatcher is reviewing now.", missingFields: [] };
  }
  const amb = state.ambulances[task.ambulanceId];
  const etaMinutes = task.etaAt
    ? Math.max(0, Math.round((Date.parse(task.etaAt) - Date.parse(state.simClock)) / 60_000))
    : null;
  return {
    state: "assigned",
    unitName: amb?.name ?? task.ambulanceId,
    etaMinutes,
    queued: task.status === "queued",
  };
}
