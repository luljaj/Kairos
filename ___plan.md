# Ambulance dispatch assistant — MVP implementation plan

Updated: November 7, 2026

This document records the agreed product scope and a proposed implementation sequence. It does not authorize operational deployment or establish a clinical dispatch protocol. The demo uses fictional fleet/crew data and simulated assignments, with a real phone number and an ElevenLabs hosted voice agent. No operational Harpur’s Ferry integration is planned.

## 1. Problem and demo

Dispatchers combine incident details, crew capabilities, ambulance availability, and travel times while handling incoming calls. The MVP brings that information together and prepares editable recommendations when calls overlap.

The central demo:

1. A dispatcher is already occupied with a call.
2. A second caller reaches the real demo phone number. The voice agent answers and gathers incident information.
3. A live incident card appears and fills in as information arrives.
4. The backend combines the incident with fleet, crew, queue, and route estimates.
5. Fine-tuned Qwen proposes an EMD level and ranks ambulance assignments with short justifications.
6. The dispatcher inspects alternatives and approves or overrides an assignment.
7. The accepted task becomes active or joins a busy ambulance’s queue.
8. The agent confirms assignment, provides estimated arrival time, and asks whether the caller wants it to stay on the line.
9. The dashboard tracks the simulated ambulance and task progress.

This demonstrates handling an additional caller and preparing a decision while the human is busy. Reduced workload and faster decisions are evaluation hypotheses, not established product results. Do not claim Harpur’s Ferry has no visual tools or that its unanswered calls are abandoned without local verification.

## 2. Ownership and architecture

- Monorepo.
- Luka: model training and the coordinating backend service.
- Friend: ElevenLabs hosted-agent integration and likely the dashboard.
- TypeScript: dashboard, coordinating backend, shared contracts.
- Python: training and model serving.
- Hosting: undecided. Empire AI training access is expected; actual account, allocation, environment, and serving connectivity still need verification.
- One dispatcher browser is authoritative. Persist state in IndexedDB, with no application database in MVP scope.
- On connection, the browser sends saved calls, fleet, tasks, queues, and revisions to the backend. The backend maintains a temporary working copy and exchanges live updates.
- New phone calls populate reliably only while the dashboard and service connections are running. Offline intake recovery is out of scope.
- Manual assignment remains usable while Qwen loads or is unavailable. A working fine-tuned Qwen path is required for the final demo.
- Mock model responses must share the real model contract so dashboard development does not depend on training completion.

Proposed layout:

```text
apps/
  dashboard/                 # TypeScript UI and browser persistence
  backend/                   # TypeScript voice/routing/model coordination
packages/
  contracts/                 # Runtime schemas, types, JSON schema exports
  fixtures/                  # Fictional fleet, scenarios, mock model results
model/
  training/                  # Python data preparation, LoRA training, evaluation
  serving/                   # Python model API and response validation
docs/                        # Integration instructions and demo runbook
```

Backend framework, UI framework, package manager, mapping provider, and deployment provider are not yet selected. Keep provider-specific code behind small adapters.

## 3. First deliverable: shared contracts

Complete contracts and fixtures before implementing separate feature branches against them. Export TypeScript types and runtime validation schemas, plus matching Python validation models or generated JSON-schema consumers. Use one canonical schema source and verify cross-language compatibility with shared fixtures.

Conventions:

- Stable IDs and ID references rather than duplicating complete entities.
- UTC timestamps, durations in seconds, coordinates with explicitly named latitude/longitude, and documented speed units.
- Unknown values are explicit `null` or documented unknown enums; never silently convert unknown durations to zero.
- Versioned wire envelopes and monotonically increasing entity/snapshot revisions.
- Keep transcripts and display assets out of Qwen inputs unless necessary for the decision.
- EMD describes the incident; every alternative within a recommendation set shares its EMD.

### Call

Fields: `id`, `revision`, `conversationId`, incident location, `incidentFacts`, live summary, conversation status, timestamps, and transcript references/entries.

A call exists before ranking or assignment. It continues receiving information after proposals or an accepted task exist. The friend will define the exact structured intake fields; do not finalize those medical fields without that input.

### CrewMember

Fields: `id`, `name`, `headshotUrl`, `role`, `qualifications`, `monthsOfService`.

Role describes the person’s job on the current crew. Qualifications describe clinical certifications and agency clearances; months of service is the agreed experience measure. Do not add an invented aggregate experience score or call-type experience counts to the initial contract.

Proposed qualification codes for fictional fixtures:

- `nys_emt`
- `nys_aemt`
- `nys_paramedic`
- `hf_driver_cleared`
- `hf_bls_crew_chief_cleared`
- `hf_als_cleared`

These are application labels, not official agency system codes. Harpur’s Ferry distinguishes EMT certification from its additional crew-chief clearance and has separate driver and ALS credentialing processes. Qualifications should be extensible without changing the model envelope.

### Ambulance

Fields: `id`, `name`, current location, speed, `crewIds`, operational status, `activeTaskId`, ordered `queuedTaskIds`, and revision.

Store queue order once on the ambulance; avoid a second independently mutable queue position on each task. Backend estimates include release time and projected release location after existing queued work.

### Task

Fields: `id`, `callId`, `ambulanceId`, `emd`, lifecycle status, incident location/reference, hospital destination (nullable), route reference, estimated arrival timestamp, justification, suitability assessment, recommendation-set reference, and timestamps.

Lifecycle: `proposed → queued → active → completed`; rejected proposals become `denied`, and unused/outdated alternatives can become `superseded`. Define cancellation behavior explicitly in the contract so queue removal is represented consistently.

Execution phases: `en_route`, `on_scene`, `transporting`, `completed`. Keep execution phase distinct from proposal/approval status. A task covers the entire incident through hospital drop-off in the simplified demo. That simplification is not a claim about actual unit release immediately on hospital arrival.

An ambulance on a proposed task is not actually assigned until human acceptance. Accepting a free unit starts the task; accepting a busy unit appends it to the end of its queue. The dispatcher can reorder or remove queued tasks, with estimates recalculated.

### RecommendationSet

Fields: `id`, `callId`, `callRevision`, `fleetRevision`, creation timestamp, outcome, shared proposed EMD, missing fields if applicable, and ordered proposed tasks.

One candidate result per ambulance. An unsuitable crew remains visible and selectable with its reason; Qwen’s suitability assessment is advisory. Deny rejects only an individual proposal. Acceptance supersedes competing alternatives for the same assignment decision.

### Qwen request

Supply an incident snapshot and compact ambulance candidates. Each candidate includes:

```text
ambulanceId
crew: [{ role, qualifications, monthsOfService }]
availableInSeconds
travelSeconds
arrivalInSeconds
```

`availableInSeconds` includes current and queued work. `travelSeconds` is from the projected release location to the new incident. `arrivalInSeconds` combines those estimates. Supply explicit unknowns if they cannot be calculated. Backend-generated route estimates and fleet facts are inputs; Qwen does not invent route geometry or arrival times.

Include request ID and incident/fleet revisions in the request envelope so the backend can correlate responses without relying on generated IDs.

### Qwen response

Use a discriminated response shape:

```json
{
  "status": "ready",
  "emd": "Delta",
  "incidentSummary": "Short summary grounded in the supplied incident",
  "rankings": [
    {
      "ambulanceId": "amb-2",
      "crewSuitable": true,
      "reason": "Brief justification grounded in supplied facts"
    },
    {
      "ambulanceId": "amb-1",
      "crewSuitable": false,
      "reason": "Specific suitability concern"
    }
  ]
}
```

```json
{
  "status": "needs_more_info",
  "emd": null,
  "missingFields": ["field identifier from the agreed intake schema"],
  "reason": "Why the available facts do not support an assessment"
}
```

Allowed EMD labels: Alpha, Bravo, Charlie, Delta, Echo. The local terminology supplied by Luka is EMD. Training labels/rubric must establish how incidents map to these levels; this plan does not invent that mapping.

Array order is rank. The backend constructs complete proposed task objects by attaching trusted IDs, route references, estimates, and statuses. Validate allowed ambulance IDs, uniqueness, candidate coverage, required fields, and response shape. A structurally valid response is not evidence of a correct recommendation.

## 4. Voice intake and recommendation triggers

1. Create the call and card immediately when intake begins.
2. Receive structured fact updates incrementally from the ElevenLabs integration.
3. Trigger the first Qwen request once there is a usable incident location and an initial description of what happened.
4. Qwen may return `needs_more_info`; display Gathering details and preserve unknown EMD instead of forcing a classification.
5. Rerun after meaningful changes to location or structured incident facts, not cosmetic transcript wording changes.
6. Coalesce rapid updates and ensure old in-flight responses cannot replace newer results.
7. Fleet/queue changes invalidate affected estimates and recommendations. Revalidate availability and queue revision on acceptance; recompute as needed.
8. After acceptance, new model output is a suggestion for review. Never silently change the accepted assignment, queue, EMD override, or other manual choice.

The initial trigger is a demo software readiness condition, not a clinically validated dispatch protocol. The exact intake fields remain owned by the friend.

The hosted ElevenLabs agent needs a verified live structured-update path to the backend and an assignment-result path back to the conversation. Its browser WebSocket transcript capabilities do not by themselves prove live transcript access for the selected hosted phone integration. Inspect that integration before choosing the transport. The incident cards should not depend on full transcript streaming.

After accepted assignment, communicate the assignment and estimated arrival, including queued wait when relevant, then ask whether to remain on the line. Define the demo’s call-ending behavior during integration.

## 5. State and event boundaries

Proposed client commands: synchronize snapshot, edit incident, request recommendations, accept proposal, deny proposal, manually assign, reorder queue, remove queued task, advance demo task phase, reset demo.

Proposed server events: incident update, transcript update if supported, recommendation started/result/error, assignment acknowledgment, fleet/queue update, and state conflict.

For every mutating command, use a command ID for duplicate protection and an expected revision. The backend validates against the connected session’s working copy, returns the resulting change, and the browser persists it. One command must not assign two ambulances or append a task twice because of retry/double-click behavior.

On reconnect, establish snapshot authority before processing new mutations. Explicitly define pending-command reconciliation; do not silently merge conflicting browser and backend snapshots. Multiple authoritative browsers and durable server-side intake are out of scope.

## 6. Dashboard behavior

- Left sidebar: live incident cards above a fleet list.
- Cards show incident summary, location, available facts, EMD/review state, and intake/assignment progress. Unknown information remains visible as unknown.
- Expandable transcript if supported by the actual phone integration.
- Map shows callers, ambulances, and routes.
- Hover available ambulance: preview route and travel time to selected incident.
- Hover busy ambulance: current route, destination, assigned call, estimated availability; distinguish the current route from a potential future assignment route.
- Click ambulance: lock the map into a following/bird’s-eye view and show crew headshots, roles, qualifications, months of service, current task, and upcoming ordered queue.
- Selecting a call highlights its assigned ambulance; selecting an ambulance highlights the related call.
- Recommendation pill shows proposed ambulance, EMD, arrival estimate, and justification, with Send ambulance and alternatives.
- Unsuitable candidates remain available with the stated concern.
- Dispatcher can edit incident details, override EMD, choose another ambulance, accept/deny proposals, and manage queues.
- After acceptance, show the acknowledged assignment and route, or queued status for a busy unit.
- Model updates must not silently overwrite dispatcher choices.
- Include local persistence, connection/loading/error states, and a reset-demo action.

## 7. Training and serving

Starting candidate: Qwen3-4B-Instruct-2507 with BF16 LoRA, short structured inputs, and a modest batch size on one allocated Empire AI GPU. Confirm actual hardware and environment before committing training settings. No login, scheduler allocation, or model-serving endpoint has been verified yet.

Training sequence:

1. Freeze contract v1 and create small representative fixtures.
2. Establish an untuned Qwen baseline through the real serving interface.
3. Build scenario data containing incident facts, fleet candidates, reviewed EMD labels, suitability assessments, ranking, and factual reasons.
4. Use synthetic scenario variation where useful, but retain a held-out reviewed set. Randomize candidate order and identifiers; split scenario families to reduce leakage.
5. Run a short GPU smoke test, record memory/throughput, save and reload the adapter.
6. Run the full fine-tune, version dataset/config/base model/adapter together, and evaluate.
7. Serve the model through the Python API; point the backend adapter at it using configuration.

Evaluate schema validity, candidate coverage, factual explanations, EMD agreement, suitability agreement, ranking agreement, insufficient-information behavior, and latency. Compare with untuned Qwen and a simple reviewed rule/nearest-qualified-unit baseline. Months of service alone is not a validated clinical suitability rule; examples need defensible labels.

Measure model selection latency separately from routing, network time, and the full intake workflow. A quarter-second response is an ambition to benchmark, not a promised requirement.

Training on Empire AI does not settle hosting. Verify whether inference runs in an active allocation with an accessible connection or on another serving host. The final dashboard must use the trained artifact; fixtures are for development and explicit demo testing.

The previously discussed scene-duration training model is outside the current core training scope. Use clearly defined fixture/service-duration estimates for demo queues unless separately added later.

## 8. Implementation sequence and acceptance checks

### Milestone 1 — Contracts and fixtures (first deliverable)

- Add monorepo skeleton and contracts package without building the full UI.
- Define entity schemas, model envelopes, event/command envelopes, revisions, enums, units, and unknown handling.
- Obtain the friend’s intake fields and confirm the hosted voice update mechanism.
- Supply fixtures for free units, busy units, queued work, unsuitable crews, insufficient information, and changed incidents.
- Validate the same fixtures in TypeScript and Python.

Done when both teammates can use the same examples and schemas without inventing additional wire shapes.

### Milestone 2 — Browser state and mock end-to-end flow

- Browser persistence and reconnect snapshot exchange.
- Backend temporary state, command validation, and mock recommendation adapter.
- Create call → update facts → obtain proposals → accept/deny → activate/queue → complete.
- Verify refresh recovery, duplicate acceptance protection, queue order, and stale-response rejection.

Done when the interface can run the full workflow without the trained model.

### Milestone 3 — Dashboard and voice integration

- Build incident cards, map interactions, crew panel, queue view, and dispatch pill.
- Connect a real phone call to structured incident updates.
- Return accepted assignment/ETA to the voice agent.
- Confirm the optional stay-on-call interaction and available transcript path.

Done when a real demo call produces a reviewable assignment and caller confirmation.

### Milestone 4 — Training and real inference

- Train, evaluate, save, and reload the adapter.
- Replace mock backend adapter with real model API.
- Validate outputs and preserve manual assignment on model errors.
- Measure serving latency on the actual demo hardware/network.

Done when the actual fine-tuned artifact produces valid recommendations in the dashboard.

### Milestone 5 — Demo rehearsal and evaluation

- Rehearse occupied dispatcher plus second caller.
- Exercise busy-unit acceptance, queue reorder, denied alternative, unsuitable-unit override, changed incident, and insufficient information.
- Confirm no model update overwrites an accepted human choice.
- Measure time to reviewed assignment and agreement with the chosen scenario rubric; record limitations.
- Document startup order, environment variables, reset procedure, required connections, and demo script.

## 9. Remaining decisions and dependencies

- Exact structured intake fields: friend to supply.
- Hosted ElevenLabs phone transport, live tool/update hooks, and transcript accessibility.
- UI/backend frameworks, mapping provider, package manager, deployment host.
- Route/service-time fixture assumptions, hospital destination selection, and demo task timing.
- Reviewed EMD and crew-suitability/ranking labels for model training.
- Actual Empire AI account, GPU allocation, environment, and inference accessibility.
- Final schema details for cancellation, manual override metadata, and reconnect reconciliation.

These do not reopen the agreed scope. Resolve them at the relevant milestone without quietly adding operational integrations or a second trained model.

## 10. Reference links

- [Harpur’s Ferry training and agency credentialing](https://harpursferry.org/about-us/training)
- [New York EMS education and certification](https://www.health.ny.gov/professionals/ems/certification.htm)
- [ElevenLabs client events](https://elevenlabs.io/docs/eleven-agents/customization/events/client-events)
- [Qwen3-4B-Instruct-2507 model card](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507)
- [Empire AI hardware guide](https://empireai.freshdesk.com/support/solutions/articles/157000363466)
- [Empire AI getting started](https://empireai.freshdesk.com/support/solutions/articles/157000374441)
- [Empire AI connection guide](https://empireai.freshdesk.com/support/solutions/articles/157000010767)

Keep this plan local unless explicitly instructed otherwise. No GitHub push is part of this task.
