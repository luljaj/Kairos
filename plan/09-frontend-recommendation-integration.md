# Frontend and recommendation pipeline integration

Prepared November 7, 2026. Planning deliverable only. The shared checkout is on main, fast-forwarded from 501874a to origin/main at 7eddd8f. The new dashboard has been inspected in source. Browser rendering and combined application checks belong to implementation.

The recommendation implementation currently lives as uncommitted changes in /Users/lukauljaj/nysairr-recommendations on codex/recommendation-pipeline. Pulling main did not bring those changes into the shared checkout.

## Intended result

Keep the new dashboard presentation and connect every operational display to the authoritative backend snapshot. Fictional sample incidents enter through existing backend entry points, trigger the real recommendation scheduler, and appear through GET /api/events. Dispatcher actions use POST /api/commands.

Voice agent setup is outside this milestone. The existing voice tool handlers and scripted caller can be reused internally. A transcript shown during a demo comes from backend scenario steps. Label the input as a scripted demo rather than implying a connected live phone call.

The full path is:

```text
Start sample incident
  → POST /api/demo/scripted-call
  → scripted steps → updateIncident → store mutation
  → recommendation scheduler → candidates and ETA
  → configured provider or deterministic fallback
  → validated RecommendationSet → store → SSE
  → dashboard recommendation, fleet, queue and map
  → dispatcher acceptance → command API → task → SSE
```

SSE delivers complete state snapshots, including replacement recommendations. Model token streaming is outside this milestone. The visible streaming behavior comes from incident updates and recommendation publications.

## Findings in the pulled frontend

| Current file | Current behavior | Required integration |
|---|---|---|
| web/app/page.tsx | Mounts DispatchDashboard | Keep this entry point |
| web/components/dispatch/dashboard.tsx | Reads ACTIVE_CALL, OTHER_CALLS and useDispatchUi from dispatch-mock | Read selected call, queue, fleet and connection status from backend state |
| web/components/dispatch/triage-card.tsx | Reads static TRIAGE, sets local sent state, dispatches locally | Render the current RecommendationSet and send commands |
| web/components/dispatch/parts.tsx | Imports mock calls and units, gates facts/transcript by elapsed mount time | Accept typed live data through props and format actual fields |
| web/components/dispatch/dispatch-map.tsx | Imports mock calls/hospitals/routes, reads local simulation positions | Consume live call/unit/hospital coordinates and actual task routes when present |
| web/lib/dispatch-mock/data.ts | Defines an independent fleet, calls, hospitals and fixed recommendation prose | Remove these operational data sources from the production dashboard |
| web/lib/dispatch-mock/sim.ts | Moves units every animation frame, loops Medic 3 transport, changes phase locally | Remove autonomous state changes from the connected dashboard |
| web/lib/dispatch-mock/use-dispatch-ui.ts | Owns local dispatch, selection and simulated state | Replace with a live adapter hook |
| web/lib/client/useDispatchState.ts | Already subscribes to /api/events and exports sendCommand | Reuse and strengthen malformed-event/error handling |
| web/app/debug/page.tsx | Exposes existing backend debug dashboard | Keep as a diagnostic entry point |

The frontend has different incident coordinates and hospital fixtures from the backend. Its route files target Bartle Library, while the existing backend fall scenario targets fictional Riverside Drive. Matching ambulance IDs alone does not make these routes valid.

The frontend sample also labels unconsciousness plus abnormal breathing as Delta. The current deterministic rubric yields Echo for those boolean inputs. Derive the acuity from the returned recommendation. For the first integrated demo, use the existing backend scenarios and their validated expectations.

## 1. Integrate the backend work with current main

1. Recheck both worktrees and branch tips before editing. Preserve the shared checkout's uncommitted model and plan work.
2. Review and commit only the completed pipeline implementation and its targeted backend documentation in the recommendation worktree. Include new backend modules and both check scripts explicitly. Exclude copied untracked plan documents and credentials from that commit.
3. Incorporate current main into that worktree and resolve any new overlap. At the inspected revisions, the incoming frontend and pipeline source changes touch separate files. Recheck this at implementation time.
4. Implement the frontend wiring in that integrated worktree, then bring the reviewed commits onto main when the checks below pass. Merge from the shared checkout only when its current edits can be preserved safely.
5. Install the updated frontend dependencies with pnpm 10.34.9 in the integrated worktree. Read the installed Next.js guidance required by web/AGENTS.md before code changes.
6. Use the worktree's environment, build output and disposable state. Check port 3001 before launching an isolated app. Run one combined app on port 3000 for the eventual demo.

The merge requires the five new pipeline modules, command/intake/scripted hooks, SSE initialization, tests, and configuration documentation from guide 08. Merely changing the frontend hook would leave request_recommendation unimplemented on current main.

## 2. Add a typed dashboard adapter

Create web/lib/client/useDispatchUi.ts backed by one useDispatchState subscription at dashboard level. Add a small pure view adapter only where several components share formatting or derivation.

Keep selection, selected candidate ID, tracked ambulance ID, pending command state and local confirmation state in React. Calls, tasks, recommendations, fleet positions, acuity and assignments come from DispatchState.

Use the existing contract types. Presentation types may contain formatted labels and optional geometry, but must derive from the snapshot and must not become a second store.

| Display | Authoritative source |
|---|---|
| Selected incident | state.calls[selectedCallId] |
| Suggested recommendation | state.recommendations[call.recommendationSetId] |
| Effective acuity | call.acuity, preserving dispatcher overrides |
| Model's suggested acuity and explanation | set.acuity and set.acuityReason |
| Candidate order | set.candidates in backend order |
| Recommended badge | candidate.ambulanceId === set.recommendedAmbulanceId |
| Availability and arrival estimate | Candidate fields in seconds, converted for display |
| Unit care level and eligibility | Existing contract helpers and candidate fields |
| Unit name and crew | state.ambulances and state.crew |
| Assignment and queued status | call.taskId, state.tasks, unit queuedTaskIds |
| Incident facts and transcript | call.facts and call.transcript as received |
| Hospitals and positions | state.hospitals and ambulance.position |
| Assigned arrival | task.etaAt relative to state.simClock |

Choose the first open unassigned call when no selection exists. Preserve a valid explicit selection across snapshots. Queue clicks select a call, and tracking remains independent. Clear invalid selections after reset. Preserve a selected candidate by ambulance ID when a result refreshes, otherwise select the first displayed candidate.

Show unknown durations as “Unknown” or “Estimate unavailable”. Never turn null into zero. Total arrival already includes waiting time, so add no second wait duration. Remove the frontend's 0.72 time multiplier and its SIM_SPEED-based ETA calculation.

## 3. Replace static triage behavior

Render all backend states explicitly.

- Loading or connecting shows a connection/loading state.
- An empty store shows a sample-incident action.
- A call without a set shows intake or waiting for assessment.
- needs_more_info shows the backend missing fields and reason.
- ready shows candidate reasons, acuity explanation, model/fallback provenance and the recommendation badge.
- stale shows that the result is being refreshed and disables acceptance.
- error shows the backend explanation and a retry action.
- Reconnection retains the last snapshot with a visible connection warning and disables dispatch until connected.
- Assigned calls show their actual task and unit, including queued status. A later advisory recommendation cannot replace accepted assignment facts.

Keep every candidate visible, including unavailable units. Treat recommendation, capability mismatch, busy/queued state, crew suitability and selectability as independent properties. The current single verdict enum cannot express their combinations.

Use neutral assignment confirmation text. The current “Crew notified · route sent to MDT” claims integrations that do not exist.

Remove or replace the inert Hold action. For this milestone, dismissing the panel may be local presentation state, but must have a clearly defined label and must not claim a backend hold workflow.

## 4. Wire dispatcher actions

Accept with the currently displayed recommendationSetId and ambulanceId. Keep one commandId for each logical action, including a retry after an uncertain network failure. Disable repeated submission while pending.

For a capability mismatch, show an explicit confirmation before sending confirmMismatch: true. An unavailable candidate is disabled. Backend validation remains authoritative even if the UI snapshot is old.

Use command success as acknowledgement and derive dispatched/queued confirmation from the subsequent SSE task state. Handle stale, conflict, not_selectable and mismatch_unconfirmed responses visibly. Do not set local success state before backend confirmation. A stale response waits for or requests a fresh recommendation.

Wire Refresh to request_recommendation. If exposing manual assignment or acuity override, use the existing command variants and the same pending/error handling. Reset uses the existing reset endpoint and clears local selection and confirmation state after the new snapshot arrives.

## 5. Supply backend-driven sample incidents

Add a small “Demo incident” control with the existing scenario IDs:

- fall-unconscious exercises missing complaint, consciousness questions and then Delta.
- busy-first-call creates the initial Bravo incident.
- breathing-charlie exercises Charlie while ALS units may already be busy.

POST to /api/demo/scripted-call once per deliberate user action. Avoid seeding calls on component mount, which would duplicate them on reload or in development Strict Mode.

To demonstrate a busy fleet, start busy-first-call, wait for its backend assessment, and assign Medic 3 using an actual command. Then start fall-unconscious and breathing-charlie. The busy state and candidate wait times must follow those tasks.

The scenarios provide inputs and transcript updates. Do not seed RecommendationSet records or recommended-unit IDs in the UI. In mock/fallback mode the same scheduler computes local results; in model mode it sends the captured request to the configured provider.

If the Bartle Library scene is later desired, add a backend scenario with coordinates and structured facts, review its expected result, and test it through the same path. Do not preserve its current static Delta label as a required model answer.

## 6. Connect the map and unit details

Replace mock unit/call/hospital imports with adapter props. Convert backend {lat, lng} to map [lng, lat] at one rendering boundary. Update and remove markers when snapshots change, including reset.

Read actual ambulance positions and task phases. Map busy units through their active task rather than assuming every busy unit is transporting. Show unavailable units appropriately.

Render task.route geometry when available. Recommendation candidates currently contain durations but no route geometry or projected release coordinates. In this milestone, show the chosen unit and incident markers and frame them together. Show road routes, remaining distance and progress only when authoritative route data exists. Remove the Bartle-specific route preview and fixed destinations from the connected view.

Vehicle movement remains a later backend simulation milestone. The current pipeline computes estimated arrival and supports manual advance_phase. A browser animation may interpolate authoritative position updates later, but must not complete phases, free units or start tasks by itself.

Keep visual camera behavior that does not change operational state. Ensure the core incident and recommendation panels work even if the map token or map tiles are unavailable.

## 7. Provider configuration and the actual Qwen target

The successful live test used OpenAI gpt-5.4-mini, with reported model gpt-5.4-mini-2026-03-17. It validated the application path in 2,156 ms for one fictional incident. The intended trained Qwen artifact has separate serving and quality checks.

The provider boundary already supports that change. The frontend reads RecommendationSet regardless of provider. The following profiles belong only in the backend environment.

| Setting | Tested OpenAI profile | Intended locally hosted Qwen profile |
|---|---|---|
| MODEL_MODE | model | model |
| MODEL_PROVIDER | openai | compatible |
| MODEL_BASE_URL | https://api.openai.com/v1 | Actual local server URL, for example http://127.0.0.1:8001/v1 |
| MODEL_NAME | gpt-5.4-mini | Exact served Qwen or adapter ID from /v1/models |
| MODEL_RESPONSE_FORMAT | json_schema | json_schema initially, or an explicitly verified supported format |
| MODEL_API_KEY | OpenAI key | Local server key if required, otherwise blank |

The shared .env.local still selected mock mode and a localhost:8000 Qwen base profile during inspection. The OpenAI smoke test used temporary process overrides. Implementation must explicitly choose the integrated app's profile.

Before switching to Qwen, obtain the trained artifact, runtime, launch instructions and exact served ID. Verify that the intended weights or adapter loaded. Compare prompt/schema versions to the training artifact. Start the runtime, validate its model-list endpoint, and send one application-shaped request through the compatible client. Then test the integrated dashboard with that profile.

Compatible requests send the trimmed training prompt and direct ModelResponse schema. OpenAI uses a private result wrapper. Keep these adapters separate. Qwen may need a runtime-specific transport adjustment after inspection, but changing the provider should not require frontend changes.

Measure Qwen latency against the existing four-second soft and eight-second hard deadlines. A slower local model will trigger labelled fallback under current behavior. If timing needs adjustment, change it deliberately with scheduler regression checks. Expose actual provenance in the UI so fallback cannot appear to be a successful Qwen response.

## 8. Verification and completion

Run the existing contract, recommendation, typecheck, lint and production-build checks against the integrated code. Extend the existing HTTP check where necessary, keeping its disposable state and process ownership safeguards.

Use browser verification for the actual dashboard and check:

1. Empty state and connection status render without mock calls or recommendations.
2. Starting fall-unconscious streams the staged facts, missing information and final recommendation into the main screen.
3. Reload and a second browser view reproduce the backend state without creating extra incidents.
4. All candidates remain visible in server order, unknown ETA stays unknown, and unavailable units cannot be selected for dispatch.
5. Acceptance creates one task. Rapid repeated clicks, uncertain network retries and stale results produce no duplicate assignment.
6. A busy-unit assignment queues once and displays total estimated arrival consistently across the card, unit detail and voice assignment API.
7. Mismatch confirmation is explicit, and dispatcher overrides remain authoritative.
8. A slow or failed provider shows fallback provenance. A valid timely model replacement updates the UI, while a response after acceptance cannot change the task.
9. Reset during a scripted incident clears the dashboard, map and pending work. Restart refreshes saved open calls.
10. Map markers match backend coordinates and hospital fixtures. The UI displays no unrelated hardcoded route or destination.
11. The OpenAI profile passes a live combined-app smoke check. Qwen passes the same check when its runtime and trained artifact are available.
12. No production dashboard imports operational data from dispatch-mock. Remove obsolete mock modules and routes after checking all consumers, while preserving reusable presentation constants in an appropriate module.

Record the tested commit, configuration profile, provider-reported model ID, prompt hash, latency, and remaining runtime dependencies in the handoff. Merge the verified integration onto main and run one combined process for the demo.

Voice-agent deployment, address geocoding, trained-model conversion/hosting setup, and authoritative vehicle simulation are separate milestones. The resulting dashboard can demonstrate the real recommendation pipeline now using scripted inputs and the configured model provider.
