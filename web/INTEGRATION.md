# Frontend integration handoff

Integration record from November 7, 2026. Current system overview: [architecture](../docs/architecture.md).
Tested application commit: `6d0e3d68333fb22d1075a6888c65e963590df92f` (including the verified Mapbox container sizing fix).
The backend pipeline was integrated from `dc6d0ff`; current main's dashboard was incorporated before frontend changes.

The main dashboard now subscribes to one validated `/api/events` snapshot stream. Incident selection, candidate selection, tracking and command feedback are local presentation state. Facts, acuity, recommendations, task assignments, queue status, crew, hospitals and map positions come from the backend. All candidates remain in backend order; unknown durations remain unknown. Assigned incidents show their task instead of subsequent advisory recommendations.

Commands retain their logical ID through uncertain retries, reject repeated submissions while pending, require explicit capability-mismatch confirmation and wait for SSE state before showing an assignment. Connection loss retains the last snapshot with a visible warning and disables commands. Refresh requests another assessment. Reset clears server work and local presentation after the reset snapshot. Scripted demo incidents start only on a deliberate button click. No production code imports `dispatch-mock`. The original browser-only simulation was removed during integration; the movement restoration below reconnects its road geometry and map presentation to shared server state.

The map renders backend coordinates and routes. Browser interpolation smooths successive server positions; the server owns movement, task phases and queue pickup. Candidate route previews use the same routing provider. The core dashboard works without a map token.

## Verification

Passed against the integrated application:

- Contract fixtures, recommendation scheduler/provider regressions, frontend selection/duration/command race checks, rendered triage state checks, TypeScript, full ESLint and the production build. The shared checkout’s newer 40-request fixture also passed contracts and fallback parity after merging.
- The disposable production HTTP suite: all three scripted scenarios, complete SSE snapshots, acceptance, busy-unit queueing, duplicate commands, stale/mismatch validation, dispatcher overrides, voice ETA consistency, phase changes, reset cancellation and restart recovery.
- Browser: empty state, streamed facts/transcript and final assessment, explicit mismatch confirmation invalidated by refresh, acceptance, reload and a second browser view without extra incidents, queue selection, busy-unit assignment (21-minute total arrival in both assignment and unit detail), tracking cleared by reset, and connection-loss warning with disabled controls.
- Render tests: loading/intake, missing information, ready, stale and error states; every candidate; unavailable and mismatch guards; unknown ETA; effective dispatcher acuity; accepted task precedence over advisory output.

Live combined-app OpenAI smoke test:

| Field | Observed value |
|---|---|
| Mode / provider | `model` / `openai` |
| Endpoint | `https://api.openai.com/v1` |
| Configured model | `gpt-5.4-mini` |
| Provider-reported model | `gpt-5.4-mini-2026-03-17` |
| Response format | `json_schema` |
| Trimmed prompt SHA-256 | `03f60d550d02e820c79904b0719c2fc357d82b91ee08467f9c3ab64199cd7264` |
| Validated inference latency | 2,162 ms |
| Result | Delta; Medic 2 recommended; accepted through the dashboard into an active task |

The model client now preserves the provider-reported model ID when present, with the configured ID as a fallback. The live key was provided only through process environment overrides; no credentials or environment files were committed.

## Running the demo

Use one combined app on port 3000. The shared checkout retains its existing `mock` profile, which exercises the actual scheduler and labels its output as deterministic fallback. The live OpenAI profile above was tested in the isolated worktree on port 3001. Restart the app with the chosen backend provider environment to change profiles; the frontend needs no provider-specific changes.

1. Start **Initial Bravo incident**, wait for assessment, select Medic 3 and assign it.
2. Start **Fall · staged intake** and select its queue row to watch missing facts resolve into Delta.
3. Start **Breathing difficulty**, select its queue row, and inspect busy-unit waiting time versus total arrival. Assigning a busy selectable unit creates a queued task.
4. Use **Reset** to clear the demonstration. No phone or crew-notification integration is implied.

## Map verification and remaining runtime dependencies

The isolated worktree had no map token, so the no-map path was browser-verified. A public token became available in the shared app during final verification. The full map was then verified on port 3000: all three fleet markers, both backend hospital fixtures, the staged incident marker, selected-unit/incident framing, and incident-marker removal on reset. This exposed and fixed Mapbox’s unlayered CSS overriding the container positioning utility. The final production build passed again with explicit full-canvas sizing.

The trained Qwen artifact/runtime was not available for this integration test. Verify its weights/adapter, exact served ID and compatible endpoint before switching profiles, then repeat the same application smoke check. Scheduler soft/hard deadlines remain four/eight seconds. Slow or failed providers produce explicitly labelled fallback; scheduler regression tests cover timely replacement and late results after acceptance.

Voice deployment, geocoding and trained-model hosting remain separate milestones. Most browser checks used disposable state in the recommendation worktree. The final map check started one fictional incident in the previously empty shared app and reset it afterward. Shared model/plan edits were preserved. One combined app is running on port 3000 with `MODEL_MODE=mock`; isolated test processes were stopped.

## Movement and map restoration

The mismatch came from `87485e7`: backend integration deleted the working local simulator introduced in `fb0b2f3` and replaced the map renderer. Restored the original distance-weighted road interpolation, cached demo routes, directional ambulance arrows, incident pulses and hospital cross markers while retaining authoritative assignments and recommendations. The existing real hospital catalog is preserved.

`lib/server/simulation.ts` starts once per Node process on SSE connection or a successful command. It advances active trips every 250 ms using `SIM_SPEED` (default 6 simulated seconds per real second), spends 480 simulated seconds on scene, transports to a catalog hospital, then activates the next queued task. Existing assignments without routes acquire routes automatically. Persisted trips resume from simulated time; offline wall time is not replayed. Reset invalidates pending routing results. Incident coordinate edits re-route an en-route unit. Missing coordinates leave the unit pending.

Road routes come from Mapbox Directions, with the original cached routes reused when endpoints match. Missing credentials or routing failures use a straight-line route marked **estimated** in unit details. The map interpolates only between received snapshots and stops when updates stop; reduced motion disables interpolation. Movement along a timed route does not invalidate in-flight model assessments. Route/phase/queue changes still do.

Verification: `simulation:check` covers movement, scene arrival, transport completion, queued pickup, persisted resumption, recommendation input stability, reset/cancellation/location-edit races, and missing coordinates. Existing contract, recommendation and dispatch checks remain applicable.

Live verification after restoration: assigning Medic 2 produced a 129-point road route (`estimated: false`) and 17 streamed snapshots over four seconds with changing coordinates. Browser verification observed en route, on scene, transport to UHS Binghamton General, and return to available; reload preserved the completed trip. The disposable production HTTP suite passed all scripted calls, acceptance, queueing, voice ETA, cancellation, reset and restart hooks. TypeScript, ESLint, contracts, recommendation and dispatch regression suites passed.
