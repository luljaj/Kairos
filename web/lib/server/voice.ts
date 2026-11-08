/** ElevenLabs server tools. The scripted caller goes through `updateIncident` too. */
import type { GetAssignmentResult, UpdateIncidentBody } from "@/lib/contracts";
import { TOOL_SECRET_HEADER } from "@/lib/contracts";
import { appendTranscript, applyIncidentChanges, createCall, findCallByConversation } from "./incidents";
import { getState, mutate } from "./store";

/** Constant-time-ish check of the shared secret. Unset secret = reject everything. */
export function checkToolSecret(req: Request): boolean {
  const expected = process.env.VOICE_TOOL_SECRET;
  const got = req.headers.get(TOOL_SECRET_HEADER);
  if (!expected || !got || got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

export function updateIncident(
  body: UpdateIncidentBody,
  extra?: {
    coords?: { lat: number; lng: number } | null;
    transcript?: { role: "agent" | "caller"; text: string }[];
  },
): string {
  const result = mutate((state) => {
    const now = new Date().toISOString();
    let call = findCallByConversation(state, body.conversationId);
    if (!call) {
      call = createCall(state, {
        now,
        conversationId: body.conversationId,
        callerNumber: body.callerNumber ?? null,
      });
    } else if (body.callerNumber && !call.callerNumber) {
      call.callerNumber = body.callerNumber;
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
              // TODO(geocoding): resolve locationText -> coords. Scripted caller passes coords directly.
              ...(extra?.coords !== undefined
                ? { coords: extra.coords, confidence: extra.coords ? "confirmed" : null }
                : {}),
            }
          : undefined,
    });
    if (extra?.transcript) appendTranscript(call, extra.transcript, now);
    return call.id;
  });
  if (result === false) throw new Error("unreachable: updateIncident always mutates");
  return result;
}

export function getAssignment(conversationId: string): GetAssignmentResult {
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
