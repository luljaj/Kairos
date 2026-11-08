# Recommendation pipeline — local app, Empire or MacBook inference

Requested November 7, 2026. Implementation plan for Luka's backend work while the frontend and model training proceed in parallel.

The deliverable is a working path from an incident update to a validated recommendation in the existing SSE state, followed by human acceptance through the existing command API. The app runs locally on Luka’s MacBook. OpenAI is an optional initial provider while training finishes. The trained model runs on Empire through an SSH tunnel, or on the MacBook through a compatible inference server. Implementation begins with local fixtures and requires neither an API key nor a running training job.

## Implementation handoff

Follow [the detailed implementation guide](08-recommendation-implementation-guide.md) in order. It specifies module interfaces, ETA arithmetic, provider request bodies, scheduler transitions, field mappings, mutation hooks, and offline/HTTP test cases. Where the guide resolves an ambiguity in this overview, use the guide.

## Deployment and integration topology

```text
Browser on demo laptop ── same-origin /api/* ── local Next.js app :3000
ElevenLabs ── HTTPS public tunnel ──────────────┘
                                                │ server-side model client
                                                ├─ localhost:8000/v1 → SSH forward → Empire GPU job
                                                ├─ localhost:8001/v1 → MacBook inference server
                                                └─ api.openai.com/v1 → optional initial OpenAI provider
```

Run one integrated Next.js process for the demo, as already specified in [00](00-overview.md) and [02](02-state-and-backend.md). It serves the frontend, route handlers, SSE, scheduler, and the single authoritative store. Keep its snapshot on the laptop. Railway is not part of this deployment.

Port 3001 is an isolated development copy of the complete app, with its own state. The friend's server on 3000 does not read the 3001 store. Integrate the backend changes into the frontend checkout for the combined demo and run one process. `useDispatchState.ts` already uses relative `/api/events` and `/api/commands` URLs, so this needs no frontend API URL, CORS, second state service, or browser model credentials.

The public tunnel reaches the local Next.js app for ElevenLabs. The SSH tunnel separately reaches the Empire model. Keep the model endpoint private. Starting or replacing a model job remains the training owner's work; implementing the pipeline requires no changes to that job, SSH configuration, or training files.

## Ownership and isolation

Implement on `codex/recommendation-pipeline` in a separate Git worktree. Use that worktree's dependency installation, `.next`, `data/state.json`, environment file, and test server port. Start development on port 3001 after checking it is free. Keep the current checkout and running frontend server available to the friend.

| Area | Ownership for this work |
|---|---|
| `web/lib/server/recommend.ts` | New pipeline, debounce, request cancellation, result application |
| `web/lib/server/eta.ts` | New shared pure travel and remaining-work estimates |
| `web/lib/server/candidates.ts` | New candidate construction and arrival estimates |
| `web/lib/server/model.ts` | Provider-aware HTTP client, private transport adapters, response validation |
| `web/lib/server/fallback.ts` | New deterministic demo fallback |
| `web/lib/server/commands.ts` | Scheduling hooks and acceptance checks |
| `web/lib/server/incidents.ts` | Invalidate on model-relevant location text/confidence changes |
| `web/lib/server/voice.ts` | Schedule after successful intake mutations |
| `web/lib/server/store.ts` | Only lifecycle support needed for reset and restart |
| `web/lib/server/scripted.ts` | Cancel pending scripted steps on reset |
| `web/app/api/events/route.ts` | Idempotent scheduler initialization for restored calls, if needed |
| `web/scripts/check-recommendations.ts`, `web/scripts/check-recommendations-http.ts` | Focused backend and command/SSE regression checks |
| `web/.env.example`, `web/README.md` | Targeted backend setup and configuration additions |
| `web/components/`, `web/lib/client/`, pages, layouts, CSS, public assets | Friend's frontend scope |
| `web/lib/contracts/`, fixtures, route URLs, command and SSE envelopes | Shared integration boundary, consumed as currently defined |
| `model/` | Training agent's scope, existing prompt and rubric are reference inputs |

Use native server-side `fetch` and the installed Zod package so implementation requires no package or lockfile changes. Review the installed Next.js documentation required by `web/AGENTS.md` before coding. Before integrating the backend branch, compare its changed files with the friend's current branch and resolve any overlap explicitly.

## Existing frontend interface

The browser continues reading `GET /api/events` and sending commands to `POST /api/commands`. A successful `request_recommendation` acknowledges scheduling immediately with the existing `CommandResult`. The completed result arrives through SSE.

The frontend reads `state.recommendations[call.recommendationSetId]`. Populate the existing fields `status`, `acuity`, `acuityReason`, `summary`, `missingFields`, `recommendedAmbulanceId`, `candidates`, `source`, `modelId`, and `latencyMs`.

Use the existing states `needs_more_info`, `ready`, `error`, and `stale`. Initial requests can have a null recommendation reference. Refreshing an existing result marks that result stale. `source: model` with the configured served model ID identifies successful inference, including the trained adapter. Preserve the selected adapter ID rather than replacing it with a generic base-model name returned by a server. A deterministic result uses `source: fallback` and a null model name. Mock responses also use fallback provenance to avoid claiming a real model call occurred.

## Model configuration and transport

Preserve `MODEL_MODE=model|fallback|mock`, `MODEL_BASE_URL`, `MODEL_NAME`, and `MODEL_API_KEY`. Add backend-only `MODEL_PROVIDER=openai|compatible` and `MODEL_RESPONSE_FORMAT=json_schema|json_object|text`. Default to `compatible` and `json_schema`, matching the existing `.env.example` and Empire serving path. Validate configuration once at startup. Provider selection is explicit so a local proxy URL does not silently select the wrong request format. These new options are planned, not implemented yet.

| Connection | Provider | Base URL | Model name |
|---|---|---|---|
| Empire via SSH | `compatible` | `http://127.0.0.1:8000/v1` | Exact ID exposed by `/v1/models`, base or approved adapter |
| MacBook inference | `compatible` | `http://127.0.0.1:8001/v1` | Exact ID exposed by the local runtime |
| Initial OpenAI | `openai` | `https://api.openai.com/v1` | User-selected supported model; previous proposal `gpt-5.4-mini` |

Use separate ports for Empire and MacBook so both can be tested without displacing the SSH forward. Changing environment configuration requires restarting the app. Keep credentials in the backend worktree's ignored `web/.env.local`, excluded from snapshots, logs, HTTP responses, and browser bundles. A compatible endpoint may have no key; omit Authorization when blank, or send the configured key when the server requires one. OpenAI requires a key. `mock` and `fallback` make no network calls.

### Empire and compatible servers

Follow [model/SERVING.md](../model/SERVING.md) and the actual request in [model/eval/evaluate.py](../model/eval/evaluate.py). Read these again at implementation time because the training agent is actively updating them.

- POST to `{MODEL_BASE_URL}/chat/completions`, with one normalized `/v1` base path.
- Use `model/prompt.md` verbatim, trimmed, as the system prompt. Load once at startup from the current worktree, record its hash, and use the version matching the selected training artifact. Do not append the OpenAI wrapper instruction to this prompt.
- Serialize the validated `ModelRequest` as compact JSON, constructing keys in `model/schemas/model-request.json` order. No transcripts, personal names, or coordinates go to the model.
- Match the serving baseline with `temperature: 0`, `max_tokens: 600`, and the direct `ModelResponse` schema. Load a private copy of `model/schemas/model-response.json`, recursively remove `uniqueItems` only for vLLM guided decoding, preserve property order (`acuityReason` before `acuity`), and never edit the schema on disk.
- Parse `choices[0].message.content` directly as `ModelResponse`. There is no `{result: ...}` envelope on this path.
- When a MacBook runtime cannot enforce this schema, explicitly configure `json_object` or `text` after its smoke check. Keep the same prompt and full output validation. Do not retry a rejected request under progressively weaker formats during a live call.

MacBook inference remains conditional on the training artifact, runtime, memory, and latency. The current FP8 vLLM launch script targets Empire's H100 slice and is not a Mac launch command. The model owner must supply a compatible served artifact (including the trained adapter, merged or otherwise supported), its model ID, and launch instructions. Serving the base model alone must not be described as serving the trained model. This pipeline does not perform conversion or install a Mac inference runtime.

### OpenAI adapter

The optional OpenAI path calls Chat Completions with a server-private `{ result: ModelResponse }` strict schema because the root union is unsuitable for that transport. Generate this wrapper from the Zod contract, adapt unsupported schema keywords only in the transport copy, and unwrap before validation. Add the envelope instruction only on this provider path. Use a bounded completion budget and provider-supported parameters, omitting Qwen's sampling settings when unsupported. [Structured output documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat)

The initial model is configurable; `gpt-5.4-mini` was the prior proposal, not a dependency of the pipeline. Confirm account access with one smoke request once the user configures a key. [Model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini)

### Common validation and timing

Both adapters return the same internal `ModelResponse`. Run `ModelResponse.safeParse` and `checkModelResponse`, checking candidate coverage, recommended ID, and acuity/explanation consistency. Map only model judgement fields into backend candidate records. Availability, care levels, routes, and arrival estimates remain server-derived.

Resolve the differing timing advice in plan/02 (8 seconds) and model/SERVING.md (fallback at 4 seconds, then replace) with a **4-second soft deadline and 8-second hard deadline**, measured in wall time from dispatching the request. At 4 seconds, publish a validated deterministic fallback while allowing that same request to continue. A valid response before 8 seconds replaces it only if request token, input fingerprint, revisions, reset generation, and assignment status still match. Explicit requests started after assignment are advisory only, as detailed in the implementation guide. Replacement creates a new recommendation ID and marks the fallback stale. If the fallback has already been accepted, discard the late model result. At 8 seconds abort and retain the fallback. Immediate HTTP, connection, refusal, truncation, parse, or validation errors publish fallback immediately and finish the run. Clear both timers on completion, supersession, and reset.

Bound model concurrency (initially one in-flight request) for the small Empire slice or Mac runtime. Coalesce pending work to the latest input per call, fairly order calls, and give queued work fallback by its own four-second waiting limit. Publish at most one fallback per input token; starting a queued request must not republish the same fallback. Check freshness again before sending. A client abort does not prove GPU work stopped, so avoid request bursts and automatic retry loops. Normal later incident changes or explicit refreshes can try the endpoint again after recovery. Do not automatically switch to a paid OpenAI endpoint when Empire disconnects. Record concise failure categories and duration without credentials or caller content.

## Local startup and handoff

For Empire, use the existing authenticated SSH session and node lookup documented by the training owner. The equivalent loopback-bound forward is:

```bash
NODE=$(ssh empire cat nysairr/model/logs/serve-node.txt)
ssh -N -o ExitOnForwardFailure=yes -L "127.0.0.1:8000:${NODE}:8000" empire
```

Check `http://127.0.0.1:8000/v1/models` with the configured authorization, if required, and select the exact exposed ID. The node file is a hint, not proof a serving job is still alive. Model jobs have a documented six-hour limit; after a job changes nodes, reopen the forward using the newly reported node. The backend never logs into SSH or launches SLURM jobs from an HTTP request.

For MacBook serving, start the separately supplied compatible server on loopback port 8001 and perform the same model-list and inference checks. Verify that the requested trained artifact actually loaded. Do not promise this deployment until the runtime check passes.

Then start the integrated local app, verify `/api/events`, run one validated model smoke request, and exercise a scripted call. Point the ElevenLabs public tunnel at that same app process. Record the provider, endpoint (without credentials), configured model ID, prompt hash, response format, and observed latency for the demo handoff. Keep `MODEL_MODE=fallback` available if inference is unavailable.

## Implementation sequence

1. **Build candidates and local response modes.** Reuse `selectability`, `careLevelOf`, `crewChiefOf`, and `REQUIRED_CARE_LEVEL`. Keep all three units visible, but send only selectable units to the model. Zero selectable units yields an `error` recommendation with explanatory summary and candidate unavailability reasons, without a model request. Sort ties by ambulance ID and unknown arrival times last.

2. **Estimate arrival from existing state.** For free units, availability is zero and travel is the existing plan's straight-line estimate, distance multiplied by 1.4 at 40 km/h. Label estimates in candidate reasons. For busy units, account for remaining active phases and every queued task, projecting release at the selected or nearest fixture hospital. Use the existing eight-minute on-scene assumption and the same travel estimator for remaining legs. Prefer stored route durations and phase deadlines when present. Legacy tasks with missing timing can use documented full-phase estimates when locations are available. Keep an unresolvable wait, travel time, and resulting arrival explicitly null. All calculations use `simClock` consistently.

3. **Implement mock and fallback results.** Use the deterministic fallback as the initial mock implementation. The existing three scripted scenarios exercise its rules with actual candidate IDs; do not add scenario IDs to ModelRequest or hardcode a recommended ambulance. Port the current keyword fallback from `model/rubric.py` and the reason templates referenced in `model/CONTRACT_CHANGES.md`, including the unresponsiveness question path. Preserve its role as a simplified demo baseline and verify parity with that baseline, separately from concept-labelled model expectations. Every result goes through the same validators and application code.

4. **Implement both model transports.** Construct `ModelRequest` from a captured incident and candidate snapshot, call the configured endpoint, validate, and normalize the response. Send only the fields in the existing model request contract. Exercise both transports against local stubs before live calls; verify the Empire payload matches the training evaluator and the OpenAI envelope stays private.

5. **Connect automatic and manual triggers.** Schedule after successful voice updates, manual call creation, incident edits, fleet changes, and explicit `request_recommendation`. Debounce automatic updates by 1.5 seconds per call. Manual requests schedule immediately while retaining command-ID deduplication. Start only after coordinates and a nonempty chief complaint exist. Missing prerequisites produce `needs_more_info` with the relevant missing fields, without calling a model. Transcript-only updates do not trigger requests. On the first runtime entry after boot, reconcile all restored open unassigned calls, including saved ready results whose transient input identities are unavailable.

6. **Apply results safely and publish SSE.** Perform HTTP work outside `mutate`, then validate current state and apply atomically. Update the call's summary and suggested acuity where appropriate, set the recommendation reference, and publish through the existing store. Derive capability mismatch using the current effective acuity, including a dispatcher override. `needs_more_info` clears an obsolete model-derived acuity for an unassigned call. It preserves a dispatcher-set acuity. Map its reason to the recommendation summary and its requested fields to `missingFields`, which the existing voice assignment endpoint already exposes.

7. **Finish acceptance integration.** Revalidate the latest recommendation, facts and fleet revisions, current unit selectability, and mismatch confirmation synchronously when accepting. Recheck eligibility for manual assignment as well. Assign once, queue busy units once, and invalidate affected recommendations for the remaining unassigned calls. Copy a valid computed arrival into `task.etaAt` using `simClock`, or preserve null when it is unknown, so `get_assignment` can return the ETA. Keep routes and destination facts server-derived.

## Concurrency and lifecycle rules

Keep per-call timers, abort controllers, and monotonically increasing request tokens in a process singleton compatible with development reloads. Snapshot model inputs before asynchronous work. Capture the facts revision, fleet revision, complete model-input fingerprint, and reset generation with each run. Compare semantic inputs without the newly generated request ID. Also track incident coordinates, which affect routing but are intentionally absent from the model payload. Comparing the fingerprint also catches address text/confidence changes, which currently do not increment `factsRevision`.

Accept a result only if its request token is current, the captured state still matches, and the call still exists. Reset cancels queued requests and soft/hard deadlines, aborts in-flight calls, advances the generation, and clears transient scheduler state. Also cancel outstanding `scripted.ts` step timers so a pre-reset caller cannot recreate an incident afterward. A slow pre-reset response must have no effect on the new demo.

If a dispatcher assigned the call during inference, discard that pending result. Subsequent explicit refreshes on assigned calls may publish an advisory recommendation, while the accepted task and dispatcher choices remain authoritative. An automatic fleet-change refresh targets calls awaiting a decision. Cancellation makes the call eligible for a fresh run.

Schedule only after successful synchronous mutations. Initialize the scheduler idempotently from server entry points (including the SSE route for restored state), without scheduling at build time or making `store.ts` import the pipeline. Expose one scheduling entry point for future geocoding and simulation updates. Address-only changes must mark the old result stale and reschedule despite the current factsRevision behavior. Keep imports flowing from command and voice entry points into the pipeline, then into the store and pure helpers. Guard scheduling against recommendation publications triggering more requests. Preserve command deduplication even when two browser clicks use different IDs by rechecking whether the call already has a task.

## Verification and completion

Use an isolated backend process and its disposable state directory. Check the public command and SSE routes as well as the pure helpers.

| Check | Required outcome |
|---|---|
| Scripted fall call | Unknown consciousness prompts for details, then known unconsciousness produces Delta, an explanation, and the expected fixture recommendation |
| Acceptance | Exactly one task is created and the existing assignment endpoint reports the chosen unit |
| Busy unit | Queue includes the task once and arrival accounts for preceding work or stays explicitly unknown |
| Missing coordinates or complaint | `needs_more_info`, correct fields, zero API requests |
| No selectable unit | `error`, visible reasons, zero API requests |
| Two overlapping requests | Only the newest valid response becomes current |
| Fleet update during inference | Old candidates are discarded and a fresh run is scheduled |
| Acuity override or assignment during inference | Dispatcher decision survives |
| Reset during debounce or inference | No old recommendation appears after reset |
| Slow inference | Fallback at 4 s, valid model replaces it by 8 s only while still current and unassigned |
| Accept fallback before late model | Accepted task and chosen unit survive; late response discarded |
| Tunnel drops, model job ends, refusal, 401/429/5xx, malformed output | Valid fallback, accurate provenance, bounded request count, no automatic provider switch |
| Compatible request shape | Verbatim prompt, compact ordered request, direct response, preserved acuityReason order, transport-only uniqueItems removal |
| OpenAI request shape | Private wrapper, successful unwrapping, same validated internal result |
| Mac endpoint without guided schema | Explicit format setting, full validation, fallback for invalid output |
| Model configuration switch | Same API and SSE shape after restart; correct selected model ID |
| Reset while scripted steps remain | Old caller cannot recreate calls after reset |
| Restart with an existing snapshot | Pending unassigned calls resume and old nullable task fields remain usable |
| Contract compatibility | Typecheck and existing contract checks pass without changing shared schemas |

Run a live integration smoke check against whichever endpoint is available, then the three scripted scenarios through normal backend endpoints. OpenAI smoke testing waits for a configured key; Empire testing waits for a serving job and tunnel; Mac testing waits for the model owner’s compatible runtime. Report configured and returned model IDs, latency, validation, and demo decisions. Stub verification can finish first, but mark each untested live target explicitly. This verifies integration separately from model quality evaluation.

The implementation is complete when a scripted incident automatically produces a validated recommendation over SSE, the existing accept command creates its assignment, failure paths produce a labelled fallback, and the concurrency checks pass. Deliver a backend-only diff and the exact configuration the friend can use for integration.

Live address geocoding, Mapbox routing, animated vehicle simulation, and frontend rendering remain separate milestones. This pipeline accepts coordinates through the existing scripted/manual-call entry points. A real phone call with address text alone will request a location until the geocoding milestone supplies coordinates.

## Existing-plan clarifications

This document refines the recommendation portion of plan/02. In particular, a fleet revision change makes an old recommendation stale; accepting that old set must fail until refreshed. The older statement that a newly busy unit can be accepted from the old set is superseded. A freshly computed set can still recommend a busy unit and acceptance queues it normally.

Plan/03's intake rules contain older keyword-oriented wording, while the current model prompt and plan/07 use meaning-based training. Consume the existing typed fields unchanged, use the current serving prompt, and compare fallback parity against the actual keyword baseline rather than claiming it matches the trained model on paraphrases. No voice prompt edits are part of this work.

The routing estimate should be a reusable helper for the later simulation/Mapbox implementation, not a second clock or movement loop. The recommendation milestone does not satisfy the dashboard's separate vehicle-motion milestone. Once geocoding resolves coordinates, it must use the same incident mutation and scheduling path; the current voice payload alone has no coordinate field.
