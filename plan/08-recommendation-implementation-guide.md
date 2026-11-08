# Recommendation pipeline — implementation instructions

Read [08-recommendation-pipeline.md](08-recommendation-pipeline.md) first for scope and hosting. This companion specifies implementation decisions and acceptance checks. Follow the stages in order. Complete the offline stages without waiting for credentials or model training. Code snippets below are proposed interfaces, not existing exports.

## 0. Prepare an isolated checkout

1. Read `web/AGENTS.md`, `plan/00-overview.md`, `plan/02-state-and-backend.md`, and this guide. Inspect `git status --short`, `git worktree list`, and existing branches before creating anything.
2. Create branch `codex/recommendation-pipeline` in a sibling worktree, for example `/Users/lukauljaj/nysairr-recommendations`. If that name already exists, inspect and reuse the intended worktree or choose an unused suffix. Never switch the shared checkout's branch, stash another person's edits, or reset files.
3. A worktree starts from committed HEAD: uncommitted plans and model updates are absent. Copy these two plan documents into the new worktree. Take a read-only snapshot of the current `model/prompt.md`, response/request schemas, `model/rubric.py`, and serving documentation needed for implementation. Record hashes and their source checkout. Do not stage another agent's uncommitted model work. At integration, verify these dependencies against the eventual model commit.
4. Install dependencies only in the new worktree. The repository specifies pnpm 10.34.9. Use that version through the available package-manager tooling. A previous shared-checkout pnpm invocation used version 11 and attempted to rebuild node_modules; do not approve such a replacement in the shared checkout. No new dependencies are needed.
5. Read the relevant installed Next.js docs under `web/node_modules/next/dist/docs/` before code changes, particularly route handlers and runtime initialization. Use the current route conventions rather than rewriting handlers to match older Next versions.
6. Use a new ignored `web/.env.local` with `MODEL_MODE=mock`. Do not copy or print someone else's credentials. Verify port 3001 is free before starting your development server. Never terminate the frontend owner's process.
7. Save baseline results from `tsx scripts/check-contracts.ts` and `tsc --noEmit --incremental false` using the installed binaries in `web/node_modules/.bin/`.

All application paths below are relative to `web/`. Preserve existing exported APIs unless this guide explicitly extends them.

## 1. File map and dependency direction

| File | Required work |
|---|---|
| `lib/server/eta.ts` (new) | Pure distance, travel, hospital selection, and remaining-task/queue estimates |
| `lib/server/candidates.ts` (new) | Backend candidate list, model request construction, input identity, display ordering |
| `lib/server/fallback.ts` (new) | Port baseline decision rules; deterministic response prose |
| `lib/server/model.ts` (new) | Configuration, prompt/schema loading, provider transport, response validation |
| `lib/server/recommend.ts` (new) | Singleton scheduler, timers, bounded queue, freshness, publication |
| `lib/server/incidents.ts` | Mark a recommendation stale for any model-relevant location change, including text/confidence |
| `lib/server/commands.ts` | Post-mutation scheduling, reset coordination, acceptance validation, ETA assignment |
| `lib/server/voice.ts` | Compare incident input before/after update and schedule after mutation |
| `lib/server/scripted.ts` | Retain/cancel scripted step timers and invalidate old generations |
| `app/api/events/route.ts` | Initialize recommendation scheduler on request before first state emission |
| `scripts/check-recommendations.ts` (new) | Pure helper, scheduler, and transport regression checks |
| `scripts/check-recommendations-http.ts` (new) | Disposable-server command/SSE/voice flow checks |
| `.env.example`, `README.md` | Configuration profiles, checks, demo startup instructions |

The scheduler may import the store, candidates, fallback, and model client. Commands and voice may import the scheduler. The store and pure incident helpers must not import commands, voice, or the scheduler. `scripted.ts` imports voice; to avoid a `commands → scripted → voice → recommend` cycle back to commands, never import commands from recommend. Keep reset entry points orchestrated in commands. If timer utilities need their own small module to preserve these dependencies, add one with an explicit purpose.

No edits to frontend components, client hook, shared contracts, model training code, or package dependencies. Do not build new public endpoints for model access or scheduler debugging. Test-only diagnostics stay inside the backend modules or test harness.

### Proposed interfaces

Use the existing contract types in these interfaces, not parallel entity definitions:

```ts
// eta.ts — pure, never reads process env or mutates state
estimateTravelSeconds(from: LatLng, to: LatLng): number
estimateAvailability(state: DispatchState, ambulance: Ambulance): {
  availableInSeconds: number | null;
  releasePoint: LatLng | null;
}

// candidates.ts — pure
buildCandidates(state: DispatchState, call: Call): Candidate[]
buildModelRequest(state: DispatchState, call: Call,
  candidates: Candidate[], requestId: string): ModelRequest
incidentInputKey(call: Call): string
fleetInputKey(state: DispatchState): string
sortForDisplay(candidates: Candidate[]): Candidate[]

// fallback.ts — pure; requires >= 1 model candidate
fallbackResponse(request: ModelRequest): ModelResponse
mockResponse(request: ModelRequest): ModelResponse

// model.ts — does not publish state or manage scheduler timers
loadModelConfig(env: NodeJS.ProcessEnv): ModelConfig
infer(request: ModelRequest, signal: AbortSignal): Promise<{
  response: ModelResponse;
  modelId: string;
  latencyMs: number;
}>

// recommend.ts — application entry points
ensureRecommendationsStarted(): void
scheduleRecommendation(callId: string, options?: { immediate?: boolean }): void
scheduleAwaitingRecommendations(): void
cancelCallRecommendation(callId: string): void
resetRecommendations(): void

// scripted.ts — retain existing startScriptedCall API
cancelScriptedCalls(): void
```

Inject `fetch`, wall clock, timer functions, and inference into a scheduler factory or equivalent internal test seam. Production uses one global instance; tests create isolated instances. Avoid exporting mutable global maps just to make assertions easy.

**Stage exit:** new modules typecheck, pure helpers have no store side effects, and the import graph has no cycle through commands or voice.

## 2. ETA algorithm

Use seconds throughout. `simClock` is the simulated time reference; model deadlines use wall time. Do not multiply or divide durations by `SIM_SPEED` when computing `etaAt`.

Travel estimate:

1. Haversine great-circle distance with Earth radius 6,371,000 metres. Convert degrees to radians and clamp the haversine intermediate to [0, 1].
2. Multiply distance by 1.4 for estimated road distance.
3. Divide by `40_000 / 3_600` metres/second. Round up to whole seconds. Identical coordinates return zero.
4. Reject nonfinite results as unknown at the caller boundary; never persist Infinity, NaN, or a negative duration.

Choose the stored task hospital if present. Otherwise choose the nearest fixture hospital by distance from the incident, breaking equal distances by hospital ID. If there is no destination or needed location, the corresponding estimate is unknown.

For an active task, let `remainingPhase` be `max(0, (phaseEndsAt - simClock)/1000)` when a valid deadline exists. Otherwise estimate the full remaining phase from known positions; document that this is approximate.

| Active phase | Remaining work | Release point |
|---|---|---|
| `en_route` | remaining route to incident + 480 s on scene + incident-to-hospital travel | hospital |
| `on_scene` | remaining scene time (480 s if no deadline) + incident-to-hospital travel | hospital |
| `transporting` | remaining route to hospital | hospital |
| Completed/cancelled referenced as active, missing task, or null phase on active task | unknown; log a concise inconsistent-state category | unknown |

A stored route may stand for the current active phase only; never reuse its duration for both outbound and transport legs. Prefer a phase deadline, otherwise a stored current-phase duration (full-phase approximation), otherwise estimate from current position. For scene-to-hospital travel, calculate a separate leg. If the code later stores more explicit routes, consume them through this helper rather than changing contracts now.

Then walk `queuedTaskIds` in their stored order. For each valid queued task, add release-point-to-incident travel + 480 s + incident-to-hospital travel; carry forward that hospital as the next release point. Ignore completed/cancelled entries, but treat missing entries, duplicate IDs, or a queued task belonging to another unit as unknown rather than silently underestimating the wait. Do not repair state inside this helper.

A genuinely free unit has no active/queued work and status `available`: availability zero, release point its position. A `busy` unit with no valid work is unknown. Out-of-service/incomplete-crew units remain visible with unavailability reasons and null ETA fields.

For each selectable unit, `travelSeconds` is release point to target incident; `arrivalInSeconds` is availability + travel only when both are known. Preserve nulls otherwise.

**Numeric acceptance case:** inject a travel function returning 60 s for every leg. A busy unit en route with a deadline 30 s ahead has `30 + 480 + 60 = 570` s remaining. One queued task adds `60 + 480 + 60 = 600` s. New-incident travel is 60 s, so arrival is 1230 s. Verify this arithmetic independently of Haversine tests.

## 3. Candidate construction and fingerprints

Populate every `Candidate` field explicitly. Initially set `crewSuitable` and `reason` to null; compute `capabilityMismatch` from an existing dispatcher override if present, otherwise the available suggested acuity. Later publication recomputes it using the effective acuity.

Use `selectability`, `careLevelOf`, and `meetsCareLevel` from contracts. Do not create a second eligibility formula. Build the request's crew array from `ambulance.crewIds`, mapping only role, qualifications, and monthsOfService. Do not send crew IDs/names, ambulance names, transcript, patient phone, or coordinates.

Two distinct orderings:

- **Model request:** selectable candidates only, sorted by arrival (null last), then ambulance ID. Include all selectable candidates even if their arrival is unknown.
- **UI state:** selectable without capability mismatch, then selectable with mismatch, then unavailable. Within each group sort by arrival (null last), then ID. Never put the model's recommended unit first just to force a ranking.

Preflight order is missing incident prerequisites first, then no selectable units, then model/fallback. Do not construct a `ModelRequest` with an empty candidate array; the schema requires at least one.

`incidentInputKey` serializes normalized facts in `FACT_KEYS` order plus location text, confidence, and coordinates. Exclude call revision, transcript, timestamps, summary, acuity, and recommendation ID. Those can change without changing inference inputs. `fleetInputKey` serializes fleet/crew/tasks/hospitals affecting candidates in stable ID order, preserving queue order; exclude recommendation records and unrelated call presentation fields. Include task incident locations used by ETA. This catches relevant mutations even if a revision hook was missed.

Capture request candidates and simulated time at request creation. Freshness compares source-input keys and revisions, not newly recalculated arrival numbers: recomputing arrival against a moving clock would make every response stale. Future continuous simulation position updates need an explicit refresh cadence; do not add a one-second model request loop in this milestone.

**Stage exit:** all three units remain visible, no unavailable unit reaches the model, model request parses, and sorting/null handling tests pass.

## 4. Deterministic fallback and mock

Port `model/rubric.py`'s `signals`, `acuity_of`, and `recommend(..., use_experience_exception=False)` in their exact order. Copy the lexicon from the read-only snapshot, including word boundaries and optional suffixes. Do not substitute substring matching, infer null as false, add a clinical rule, or implement the experience exception in fallback.

The prose in older plan/02 is abbreviated: both consciousness and breathing unknown do **not** always imply missing information if the complaint settles a rule. The Python baseline is the parity source, including its limitations on negation. Generate a baseline oracle for the 40 demo requests by calling `rubric.label(request, use_experience_exception=False)` in an offline script. This needs only the standard library. Compare status, acuity, missing fields, recommended ID, and suitability. Do not compare against concept-labelled gold answers or demand identical random prose.

For reasons, use a fixed template per returned rule, naming exactly its acuity and required care. Take templates from `model/data/generate.py::acuity_reason` where practical; no random choice is needed. Summary can use the chief complaint, bounded to 200 characters. Candidate reasons must be <=160 characters and use input-derived estimates only. Unknown ETA says "Arrival estimate unavailable". Label computed travel as estimated without altering the shared schema. Validate the final fallback with the same Zod and semantic checks used for inference. An internal fallback validation error must result in a well-formed `error` RecommendationSet and an internal error log, not an invalid persisted response.

Define `mockResponse` to call the deterministic fallback for this first implementation. The existing scripted scenarios already exercise that rubric; no scenario ID is present in `ModelRequest`, so do not add one or hardcode ambulance IDs. Mock mode's purpose is reproducible UI integration, not simulating the fine-tuned model's experience preference. Provenance is `fallback`, modelId null.

Required small rubric cases in addition to the oracle:

| Facts (remaining fields null unless stated) | Expected |
|---|---|
| complaint "Father fell down the stairs, not answering" | needs_more_info, conscious + breathingNormally |
| same, conscious false, breathingNormally true | Delta |
| same, conscious false, breathingNormally false | Echo |
| complaint "Asthma, short of breath", conscious true, breathingNormally false | Charlie |
| complaint "Slipped and hurt wrist", conscious true, breathingNormally true | Bravo |
| complaint "sore throat", conscious true, breathingNormally true | Alpha |
| complaint "not well" | needs_more_info |

**Stage exit:** baseline parity and response validators pass, with zero network calls in mock/fallback modes.

## 5. Provider client

Load configuration lazily at runtime, once per production singleton. Defaults: mode mock, provider compatible, response format json_schema, base URL `http://127.0.0.1:8000/v1`, compatible model `Qwen/Qwen3-4B-Instruct-2507`. For OpenAI require an explicit model name and key. Reject invalid enum values and non-http(s) URLs. Configuration errors should disable inference with one concise log and allow the local UI/fallback to operate; never leak environment values in the message.

Resolve prompt/schema paths relative to the repository root from the documented `web/` working directory. Read assets once; record a SHA-256 prompt hash. Missing assets disable real inference but must not break mock/fallback startup. Do not read model files per request or invoke Python in the live server.

Normalize the URL by removing trailing slashes and appending `/chat/completions`; the configured base already includes `/v1`. Do not append a second `/v1`.

Compatible body:

```ts
{
  model: config.name,
  temperature: 0,
  max_tokens: 600,
  messages: [
    { role: "system", content: prompt.trim() },
    { role: "user", content: JSON.stringify(validatedRequest) }
  ],
  // json_schema mode only:
  response_format: {
    type: "json_schema",
    json_schema: { name: "ModelResponse", schema: compatibleSchema }
  }
}
```

For compatible `json_object`, use `{type:"json_object"}`. For `text`, omit response_format. Always parse plain JSON with the full contract; do not extract JSON from Markdown fences or repair model answers.

For OpenAI use the private strict `{result: ModelResponse}` schema from the main plan. Derive it with the installed Zod JSON-schema exporter; preserve definitions/references when adapting. Remove only documented unsupported keywords, never blindly flatten the union or remove required/additionalProperties constraints. Start with `max_completion_tokens: 2048` and omit temperature. Verify these parameters against the selected model's official docs before the live smoke call. Reject OpenAI non-json_schema configurations in this milestone. This provider's system text may append the wrapper instruction; the compatible system text must remain byte-identical after trimming.

For both providers: pass the supplied AbortSignal to fetch, check HTTP status, parse the response envelope, reject nonempty refusal, require finish_reason `stop`, require string message content, JSON.parse it, unwrap only for OpenAI, then apply `ModelResponse.safeParse` and `checkModelResponse`. Return a typed failure category for configuration, transport, HTTP, refusal, truncation, JSON, schema, or semantic errors. Do not log raw HTTP bodies or prompts. Store configured model ID in RecommendationSet; returned server model ID can be logged separately.

The model client owns no retries, fallback publication, soft timers, or store access. The scheduler owns those behaviors.

**Stage exit:** local HTTP stub verifies both request bodies and validation failures. No live provider required.

## 6. Scheduler state machine

Keep process-local transient state in `globalThis.__recommendations`, separate from persisted DispatchState. Its minimum contents are initialized flag, reset generation, next token counter, per-call debounce timers, pending FIFO with one latest job per call, active job, and per-job deadline handles. Each job captures call ID, token, generation, factsRevision, fleetRevision, incident/fleet keys, captured taskId, immutable request/candidates, wall-clock timing, AbortController, and whether fallback was published. Keep a reference to every timer so reset can clear it.

Use these transitions:

1. **schedule:** ignore missing/closed calls. Automatic triggers skip assigned calls; explicit immediate requests may refresh assigned calls. Increment token immediately, invalidate prior work for that call, abort its active request if any, clear its debounce/queue timers, and mark its latest recommendation stale. Apply staleness via a synchronous mutation only if needed. Automatic work starts after 1500 ms without another relevant update; explicit requests enqueue immediately.
2. **preflight:** capture a fresh immutable snapshot after debounce. Missing coordinates/blank complaint publishes `needs_more_info` with `location`/`chiefComplaint` in that order. Otherwise build candidates. No selectable candidates publishes `error`. Neither path calls inference.
3. **enqueue:** in mock/fallback mode publish synchronously through the normal validation/application path and finish. In model mode append one job per call to FIFO. If it waits four seconds, publish fallback once but keep the job pending for an eventual real attempt. A superseding input removes the old job. Starting an already-fallback-published job must not publish the fallback a second time.
4. **start:** when there is no active job, pop the next current job. Check freshness, record startedAt, create soft (4000 ms) and hard (8000 ms) timers from start, and call infer outside a mutation. The queue-wait fallback timer is cleared at start. There is at most one active fetch globally.
5. **soft deadline:** publish fallback once if still current. Keep the request active. Fallback publication changes the call summary/acuity/reference but not the input identity or request token.
6. **success:** before the hard deadline, validate freshness and publish the model result. Mark any previous fallback set stale; create a new ID. Finish and drain the queue.
7. **failure:** if still current, publish fallback once and finish. A superseded/reset cancellation must not publish fallback. A hard deadline publishes fallback if needed, invalidates the job, aborts its fetch, and finishes. Guard against a fetch resolving after timeout even if abort was ignored.
8. **finish:** clear every job timer and release the active slot only if this job owns it. Late `finally` callbacks from an old job must not clear a newer active job. Drain the queue. Avoid an unhandled rejection on aborted inference.

Use one `isCurrent(job, state)` predicate at every publication. Require generation/token match, call exists and is not closed, both revisions match, source-input keys match, and `call.taskId === job.capturedTaskId`. An initially unassigned call assigned during inference fails that test. A later explicit advisory request captured on an assigned call may publish while the same task remains assigned; it never edits call acuity/summary/status or task fields. If that task is cancelled or completed, discard the advisory run. This clarifies the main plan's late-response rule for explicit advisory requests.

Two clocks: simulation time for travel/etaAt; monotonic wall time for elapsed latency and deadlines. `latencyMs` records model inference duration on a model result and elapsed wait on a timeout fallback; immediate local results may use zero. Metadata timestamps such as createdAt/setAt use wall-clock ISO timestamps, matching the existing code.

`ensureRecommendationsStarted` initializes once and schedules every open unassigned restored call. Refresh even a saved ready result on restart, because the transient input identities and serving configuration are gone. Do not schedule in module top-level evaluation. Call it from real server entry points; the SSE route calls it before its initial snapshot. `resetRecommendations` increments generation and clears all jobs/timers before state replacement; it must not leave initialization permanently disabled.

**Stage exit:** fake-clock tests prove newest input wins, global concurrency stays at one, fallback publishes at most once, reset invalidates work, and late callbacks cannot overwrite newer results.

## 7. Publish RecommendationSet without changing contracts

Construct a new complete object, validate with `RecommendationSet.parse`, then apply in one `mutate` callback that rechecks freshness. Never spread a raw provider object into state.

| Field | ready | needs_more_info | error (preflight/internal failure) |
|---|---|---|---|
| id / callId / revisions / createdAt | generated ID, captured metadata | same | same |
| source / modelId | model + configured ID or fallback + null | same provenance rule | fallback + null |
| status | ready | needs_more_info | error |
| acuityReason | response.acuityReason | null | null |
| acuity | response.acuity | null | null |
| summary | response.summary | response.reason | short explanatory message |
| missingFields | [] | response.missingFields | [] |
| recommendedAmbulanceId | response ID | null | null |
| candidates | trusted backend fields + matching judgement by ID | trusted fields, judgement null | trusted fields, judgement null |
| latencyMs | measured | measured/local zero | measured/local zero |

For preflight with missing coordinates, candidates may retain eligibility/care facts and null travel estimates. For no selectable units, all units remain visible with unavailability reasons. Do not fabricate model responses for these cases; construct RecommendationSet directly.

For an unassigned call: ready sets status `awaiting_decision`; needs_more_info sets `intake`; error sets `awaiting_decision`. Copy summary. Set suggested acuity from ready unless source is dispatcher. On non-ready output, clear previous model/fallback acuity but preserve dispatcher acuity. Compute candidate mismatch using dispatcher acuity if present, otherwise new suggested acuity. `crewSuitable` stays the model/fallback judgement even if dispatcher acuity differs. Sort the display list after mismatch computation. Mark the previous set stale, insert the new set, update call.recommendationSetId, and `touch(call, now)`.

Assigned advisory publications only change the recommendation reference and touch the call; preserve the call's accepted display facts and task. RecommendationSet still carries the new suggested acuity/summary for advisory rendering. Do not invent a new public advisory field; existing taskId and recommendation data suffice for future UI work.

## 8. Wire entry points and acceptance

Scheduling must happen after a successful synchronous mutation, not in `applyIncidentChanges` or `fleetChanged`. Capture before/after input identities or a small internal effect list. Do not attach internal scheduling metadata to public CommandResult.

| Entry/action | Hook after success |
|---|---|
| create_manual_call | schedule new ID |
| edit_incident | schedule only if incident input identity changed |
| updateIncident | schedule new/changed call; transcript-only or repeated identical facts do nothing |
| request_recommendation | validate call exists/not closed, return existing success shape, immediate schedule |
| accept_recommendation / manual_assign | cancel assigned call's pending inference; schedule remaining open unassigned calls |
| cancel_task | cancel pending work for affected call, schedule that call and other open unassigned calls |
| advance_phase | if phase really changed, bump fleetRevision, mark open sets stale, schedule open unassigned calls |
| override_acuity | update mismatch and display ordering locally, no inference |
| reset_demo | cancel scheduler and scripted timers, replace state, resume initialized scheduler |
| repeated commandId or failed command | no new scheduling |

`request_recommendation` with missing prerequisites succeeds in scheduling a needs_more_info result rather than returning invalid. A missing call returns not_found; a closed call returns conflict. Capture/remember the command result once so a repeated commandId never creates another inference run. Return a revision consistent with the acknowledged synchronous changes; later publications arrive through SSE.

In `incidents.ts`, keep the existing factsRevision semantics, but also invalidate the latest set when location text/confidence changes. The entry point's input comparison will schedule. In `advancePhase`, the current code bumps fleetRevision only on completion: extend this to the other real phase transitions because remaining work/position change. Ensure completion bumps it once, not twice. A no-op phase transition must not bump it.

For acceptance, perform all checks before calling assign or mutating any entity:

1. Set/call/unit exist; set is current, ready, and not stale; call has no task and is not closed.
2. Stored factsRevision/fleetRevision match current values.
3. Candidate exists, live unit remains selectable, and effective current acuity mismatch has been confirmed when necessary. Do not trust the cached candidate boolean alone.
4. Compute the selected unit's current ETA using the pure estimator; do this before adding the new task, so its own work is not counted in its wait.
5. Pass `etaAt` into assign (`simClock + arrivalSeconds*1000` or null), create exactly one task, update unit/call, and bump fleetRevision through the existing path. Manual assignment uses the same estimator.

A failed check returns the existing error code and leaves no partial task/queue changes. Duplicate commandId returns its original result. A second accept with a different ID fails because the call already has a task. Test both cases.

`scripted.ts` must keep a process singleton Set of timer handles and a generation. Remove handles when fired, check generation before calling updateIncident, and cancel/increment on reset. Preserve `startScriptedCall`'s public return value. Do not change scenario timings or content.

## 9. Verification sequence

Do not add a testing framework. Use installed tsx, `node:assert/strict`, a local `node:http` stub, and an injected fake clock. A deferred Promise can simulate late inference without long real sleeps. Run checks from an isolated worktree and disposable state directory. If the existing store's fixed snapshot path complicates tests, inject the store adapter into scheduler tests; do not overwrite the user's saved snapshot.

Required regression groups:

1. ETA numeric example from section 2; free unit; every active phase; two queued tasks; past deadline clamped; unknown task/location/hospital; unavailable crew; deterministic tie.
2. Fallback oracle parity over all 40 requests plus section 4 cases; all-unknown arrival values; no suitable ALS candidate; mock/fallback zero fetch calls.
3. Transport snapshots: trimmed prompt byte equality; compact request; schema uniqueItems removed only in copy; acuityReason before acuity; no OpenAI wrapper sent to compatible; wrapper unwrapped for OpenAI; empty API key allowed only for compatible.
4. Transport failures: connection rejection, 401, 429, 500, refusal, finish_reason length, nonstring content, malformed JSON, unknown candidate, duplicate candidate, missing candidate, wrong acuityReason level. Each produces one valid fallback via scheduler and no automatic retry.
5. Timing with fake clock: schedule A then B for same call, A resolves last; fallback at 4000 ms then model at 5000 ms; hard cutoff at 8000 ms then ignored success at 9000 ms; queue wait fallback; reset at 1000 ms; assignment after fallback before real answer; dispatcher override during inference.
6. Hooks: identical facts/transcript-only produce no new inference; address text-only edit does; each phase transition invalidates; failed and duplicate commands schedule nothing; restart refreshes persisted ready/pending calls; scripted callbacks cannot create calls after reset.
7. State schema parses after every publication, queue updates, and reset. No nonfinite times or extra schema fields.

HTTP integration script against a disposable app on port 3001:

1. Connect `/api/events`, parse SSE `event: state` frames, and validate each snapshot. Handle chunks split mid-line and multiple frames per chunk; do not assume one fetch chunk equals one event.
2. POST `/api/demo/reset`. Start `/api/demo/scripted-call` with scenario `fall-unconscious`. Observe location-only missing complaint, then unknown consciousness questions, then Delta and the expected fixture unit. If using real scenario timers, allow about 20 seconds for the final update; use state predicates with deadlines rather than fixed sleeps.
3. Accept the current recommendation through `/api/commands`, assert one task and exactly one unit reference. Repeat the same command ID and then a new ID to test deduplication/conflict separately.
4. Query `/api/voice/tools/get-assignment` with the same conversationId and the configured test secret. Verify assigned unit name and ETA minutes (or null when deliberately unknown).
5. Create another call and assign a busy unit; verify queued exactly once and ETA reflects preceding work. Test BLS/Delta mismatch rejection and confirmed override.
6. Reset during a scripted call, wait beyond its remaining scheduled steps, and confirm the reset stays empty.
7. Restart the disposable app against its saved snapshot, reconnect SSE, and observe the documented restored-call reconciliation.

Run from `web/`, using installed binaries if the pnpm wrapper differs from the pinned version:

```bash
./node_modules/.bin/tsx scripts/check-contracts.ts
./node_modules/.bin/tsx scripts/check-recommendations.ts
./node_modules/.bin/tsc --noEmit --incremental false
./node_modules/.bin/eslint lib/server scripts/check-recommendations.ts scripts/check-recommendations-http.ts app/api/events/route.ts
./node_modules/.bin/next build
```

Run the HTTP script against the isolated dev or production process, then stop only the process the implementation agent started. Record live checks separately from stub checks. No Empire or OpenAI quality claim follows from mocks passing.

## 10. Delivery checklist and stopping conditions

- [ ] Backend-only diff with the documented file boundaries; no training or frontend edits.
- [ ] Offline checks pass, including command/SSE acceptance and timeout/reset races.
- [ ] `.env.example` documents planned options as implemented only after code exists; three connection profiles in README.
- [ ] README says one combined process for demo, 3001 for isolated development only, and names the geocoding/simulation work still outstanding.
- [ ] Prompt/schema/rubric hashes and source model commit recorded in handoff; recheck changed upstream artifacts before integration.
- [ ] Available live target smoke-tested with exact configured model ID and validation/latency reported. Unavailable targets explicitly marked untested without blocking offline completion.
- [ ] No API key printed, committed, sent to browser, or copied from another person's local env.
- [ ] Report changed files, tests, remaining integration dependencies, and exact local startup command. Do not claim the full animated dispatch demo is complete.

If the Mac runtime or serving artifact is unknown, finish the compatible transport and stub tests and report that one live dependency. If the model training agent changes the contract, compare it to the existing shared schemas and report the concrete mismatch before altering a shared boundary. Routine implementation choices within these interfaces do not require further user approval.
