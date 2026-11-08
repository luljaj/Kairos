# 02 — State and backend (Next.js server)

Owner: Luka. Lives in `web/lib/server/` and `web/app/api/`.

## Runtime

- One Next.js app, run as one long-lived Node process: `pnpm build && pnpm start` on the demo laptop. Development with `pnpm dev` works but HMR can create a second store; guard with a `globalThis` singleton.
- Route handlers use the Node runtime (`export const runtime = "nodejs"`), never Edge.
- Public URL for ElevenLabs webhooks: Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:3000`) or ngrok. Put the URL in the ElevenLabs tool config.
- Not Vercel: serverless instances do not share memory and close long SSE connections.

## Store

```ts
// web/lib/server/store.ts
type State = { revision: number; simClock: string; calls: Record<id, Call>; ambulances: …; crew: …; tasks: …; recommendations: … };
globalThis.__dispatch ??= { state: loadSnapshotOrFixtures(), listeners: new Set(), seenCommandIds: new LRU(500) };
```

- The server is the only writer. Every change goes through `applyCommand(cmd)` or an internal event (voice update, model result, sim tick).
- Node runs these synchronously on one thread, so there are no races inside a mutation. Never `await` in the middle of a mutation: compute async things (routes, model calls) first, then apply the result in one synchronous step that re-checks preconditions.
- After each change: `state.revision++`, bump the entity's `revision`, notify listeners, schedule a debounced (500 ms) write to `web/data/state.json`.
- On boot: load `state.json` if present, else fixtures. `reset` reloads fixtures and clears calls/tasks.

## Browser connection

- `GET /api/events` — SSE. Sends the full state on connect and after every change (throttled to 10/s). The browser replaces its copy. The fleet is 3 units, so full snapshots are cheap and remove patch/merge bugs.
- `POST /api/commands` — body `{ commandId, type, ...payload }`. Returns `{ ok, revision }` or `{ ok: false, error, message }`.
- Refresh or reconnect = reload the snapshot. Nothing to reconcile.
- Duplicate protection: `commandId` (UUID from the browser) stored in `seenCommandIds`; a repeat returns the original result.

## Commands

| Type | Payload | Preconditions (checked synchronously) |
|---|---|---|
| `accept_recommendation` | `recommendationSetId, ambulanceId, confirmMismatch?` | set is latest for the call and not stale; call has no task; candidate selectable; if `capabilityMismatch` then `confirmMismatch` true |
| `manual_assign` | `callId, ambulanceId, confirmMismatch?` | call has no task; ambulance selectable |
| `override_acuity` | `callId, acuity` | — (sets source `dispatcher`, recomputes mismatch flags; does not re-run the model) |
| `edit_incident` | `callId, location?, facts?` | bumps `factsRevision` if values changed |
| `request_recommendation` | `callId` | location coords present |
| `cancel_task` | `taskId` | task queued or active |
| `move_queued_task` | `taskId, toIndex` | stretch goal |
| `advance_phase` | `taskId` | demo control: skip timer |
| `create_manual_call` | `location, facts` | for the busy-dispatcher first call and testing |
| `reset_demo` | — | — |

Accepting a stale recommendation returns `error: "stale"`; the UI shows the fresh set. If the chosen ambulance became busy since the set was made, accept still succeeds but the task is queued, and the response says so.

## Recommendation pipeline

Trigger when a call has `location.coords` and at least `chiefComplaint`, and then on every `factsRevision` change. Debounce 1.5 s per call.

1. **Candidates (deterministic).** For each ambulance:
   - `selectable` = status not `out_of_service` and `crewComplete`.
   - `availableInSeconds` = remaining time of active task + fixed durations of queued tasks (see Simulation). `0` if available.
   - Projected release point = hospital of the last task, or current position if free.
   - `travelSeconds` = route duration from release point to incident (routing below).
   - `arrivalInSeconds` = sum; `null` if either part is `null`.
2. **Judgement.** Send selectable candidates (sorted by arrival; at most 3) to the model client. Timeout 8 s.
3. **Fallback** (model error, timeout, invalid JSON, or `MODEL_MODE=fallback`): deterministic rules:
   - acuity from a keyword/boolean rule table (same table as the demo rubric in 05),
   - `needs_more_info` if `conscious` and `breathingNormally` are both null,
   - recommend the fastest selectable unit whose `careLevel` meets the acuity's required level, else fastest overall,
   - reasons are templated ("ALS crew, arrives in ~5 min").
4. **Eligibility after acuity.** With the acuity known (from model or dispatcher override), mark `capabilityMismatch` where `careLevel` is below the required level.
5. **Apply.** Synchronously: if `call.factsRevision` still equals the request's, store the set and point the call at it; otherwise discard it (a newer request is on its way). Older sets for the call become `stale`.
6. **Never** change an accepted task, its unit, or a dispatcher-set acuity because of a new result. New results after acceptance are stored but shown as "new suggestion" only.

Fleet changes (task accepted, unit freed, cancellation) mark all open sets `stale` and re-run candidates for calls awaiting a decision (debounced).

## Model client

```ts
// web/lib/server/model.ts
MODEL_MODE = "model" | "fallback" | "mock"
MODEL_BASE_URL = http://…/v1           // vLLM OpenAI-compatible server
MODEL_NAME = qwen3-4b-dispatch-lora | Qwen/Qwen3-4B-Instruct-2507
```

Calls `/chat/completions` with the system prompt and JSON request from 05, `temperature: 0`, JSON response format if the server supports it. Validates with the zod response schema. Records `latencyMs` and `modelId`. `mock` returns fixture responses keyed by scenario for UI work.

## Routing

- Mapbox Directions API, `driving-traffic` off (use `driving` for repeatability). Request includes `geometries=geojson&overview=simplified`.
- Cache by rounded origin/destination (4 decimals) in memory.
- Fallback if routing fails: straight-line distance × 1.4 at 40 km/h, geometry = straight line, flagged `estimated: true` in the UI.
- Pre-warm: on boot, fetch routes from every station to every scenario incident location, so the demo does not depend on live latency.

## Simulation

A 1 s interval advances `simClock` by `SIM_SPEED` (default 4×) seconds.

| Phase | Duration | Movement |
|---|---|---|
| `en_route` | route duration | interpolate along route geometry |
| `on_scene` | 8 min | stays at incident |
| `transporting` | route to hospital | interpolate |
| `completed` | — | unit becomes available at hospital; next queued task starts |

Queued-task duration estimate for `availableInSeconds`: travel + 8 min + transport, using cached routes or the fallback formula. Hospital = nearest from a fixture list of 2–3 fictional hospitals.

## Environment variables

```text
MAPBOX_TOKEN, NEXT_PUBLIC_MAPBOX_TOKEN
MODEL_MODE, MODEL_BASE_URL, MODEL_NAME, MODEL_API_KEY
VOICE_TOOL_SECRET
SIM_SPEED
```

## Done when

- Two scripted calls (see 03 fallback) run end to end with `MODEL_MODE=mock`: card → recommendation → accept → unit moves → completes.
- Double-clicking accept creates one task.
- Editing a fact while a model call is in flight leaves only the newer result.
- Accepting a busy unit queues the task with a correct wait.
- Killing and restarting the server restores state from `state.json`.
