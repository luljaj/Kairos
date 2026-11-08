# Frontend integration handoff

Implemented November 7, 2026 from `plan/09-frontend-recommendation-integration.md`.
Tested application commit: `87485e7366df410bafd6fc0d87c93273422b7e90`.
The backend pipeline was integrated from `dc6d0ff`; current main's dashboard was incorporated before frontend changes.

The main dashboard now subscribes to one validated `/api/events` snapshot stream. Incident selection, candidate selection, tracking and command feedback are local presentation state. Facts, acuity, recommendations, task assignments, queue status, crew, hospitals and map positions come from the backend. All candidates remain in backend order; unknown durations remain unknown. Assigned incidents show their task instead of subsequent advisory recommendations.

Commands retain their logical ID through uncertain retries, reject repeated submissions while pending, require explicit capability-mismatch confirmation and wait for SSE state before showing an assignment. Connection loss retains the last snapshot with a visible warning and disables commands. Refresh requests another assessment. Reset clears server work and local presentation after the reset snapshot. Scripted demo incidents start only on a deliberate button click. No production code imports `dispatch-mock`; its data, routes and autonomous simulation were removed.

The map renders backend coordinates and only draws routes supplied on active tasks. No browser timer moves vehicles, changes task phases or invents a route. The core dashboard works without a map token.

## Verification

Passed against the integrated application:

- Contract fixtures, recommendation scheduler/provider regressions, frontend selection/duration/command race checks, rendered triage state checks, TypeScript, full ESLint and the production build.
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

## Remaining runtime dependencies

No Mapbox token is configured, so the no-map path was browser-verified. Actual tile/marker rendering still needs a valid public token. Marker reconciliation, coordinate conversion and route filtering are implemented, but visual map verification remains pending that token.

The trained Qwen artifact/runtime was not available for this integration test. Verify its weights/adapter, exact served ID and compatible endpoint before switching profiles, then repeat the same application smoke check. Scheduler soft/hard deadlines remain four/eight seconds. Slow or failed providers produce explicitly labelled fallback; scheduler regression tests cover timely replacement and late results after acceptance.

Voice deployment, geocoding, trained-model hosting and authoritative vehicle simulation remain separate milestones. Browser checks used disposable state in the recommendation worktree; shared model/plan edits and the shared app's existing state were preserved.
