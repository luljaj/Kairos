import React from "react";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { TriageCard } from "@/components/dispatch/triage-card";
import type { DispatchUiState } from "@/lib/client/useDispatchUi";
import { initialState, scenarios } from "@/lib/server/fixtures";
import { createCall } from "@/lib/server/incidents";
import { buildCandidates } from "@/lib/server/candidates";
import type { RecommendationSet, Task } from "@/lib/contracts";

const state = initialState();
const call = createCall(state, {
  now: state.simClock,
  location: scenarios["fall-unconscious"].location,
  facts: { chiefComplaint: "Test incident" },
});
call.acuity = { value: "Delta", source: "dispatcher", setAt: state.simClock };
const candidates = buildCandidates(state, call);
const set: RecommendationSet = {
  id: "rec-test",
  callId: call.id,
  factsRevision: call.factsRevision,
  fleetRevision: state.fleetRevision,
  createdAt: state.simClock,
  source: "fallback",
  modelId: null,
  status: "ready",
  acuityReason: "Test explanation",
  acuity: "Charlie",
  summary: "Assessment summary",
  missingFields: [],
  recommendedAmbulanceId: candidates[0].ambulanceId,
  candidates,
  latencyMs: 0,
};
const noAction = () => {};
const s = {
  state,
  call,
  set,
  candidate: candidates[0],
  task: null,
  canAct: true,
  refresh: noAction,
  accept: noAction,
  selectCandidate: noAction,
  setTrackedId: noAction,
} as unknown as DispatchUiState;
const render = (patch: Partial<DispatchUiState> = {}) =>
  renderToStaticMarkup(<TriageCard s={{ ...s, ...patch }} />);
const disabled = (html: string) =>
  assert.match(html, /<button[^>]*disabled=""[^>]*>Assign/);
let html = render();
assert.match(html, /dispatcher/);
assert.match(html, /Suggested acuity: Charlie/);
assert.match(html, /Deterministic fallback/);
assert.match(html, /1 of 3/);
assert.match(html, /Previous option/);
assert.match(html, /Next option/);
for (const candidate of candidates) {
  const optionHtml = render({ candidate });
  assert.ok(optionHtml.includes(state.ambulances[candidate.ambulanceId].name));
  assert.match(optionHtml, new RegExp(`${candidates.indexOf(candidate) + 1} of 3`));
}
disabled(render({ canAct: false }));
disabled(render({ set: { ...set, status: "stale" } }));
disabled(render({ candidate: { ...candidates[0], selectable: false } }));
disabled(render({ candidate: { ...candidates[0], capabilityMismatch: true } }));
html = render({
  set: {
    ...set,
    candidates: candidates.map((candidate) => ({
      ...candidate,
      arrivalInSeconds: null,
    })),
  },
  candidate: { ...candidates[0], arrivalInSeconds: null },
});
assert.match(html, /Unknown/);
assert.match(
  render({
    set: { ...set, status: "needs_more_info", missingFields: ["conscious"] },
  }),
  /More information needed: Conscious/,
);
assert.match(render({ set: { ...set, status: "error" } }), /Retry assessment/);
assert.match(render({ set: null }), /waiting for assessment/);
assert.equal(render({ call: null }), "");
const task: Task = {
  id: "task-test",
  revision: 0,
  callId: call.id,
  ambulanceId: "amb-3",
  status: "queued",
  phase: null,
  acuityAtAcceptance: "Delta",
  hospital: null,
  route: null,
  phaseEndsAt: null,
  etaAt: null,
  acceptedFromRecommendationId: set.id,
  override: null,
  createdAt: state.simClock,
  updatedAt: state.simClock,
};
html = render({ task });
assert.match(html, /Medic 3/);
assert.match(html, /Queued/);
assert.match(html, /Unknown/);
assert.ok(
  !html.includes("Assessment summary"),
  "advisory recommendation cannot replace assignment facts",
);
console.log(
  "Rendered assessment states, all candidates, dispatch guards, override acuity, and assignment precedence passed.",
);
