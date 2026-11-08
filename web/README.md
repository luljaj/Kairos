# web/ — dispatch assistant (UI + backend)

One Next.js 16 app (App Router, TypeScript), run as **one long-lived Node process**. State lives in server memory and is snapshotted to `data/state.json` (gitignored). Plans: `../plan/01-contracts.md`, `../plan/02-state-and-backend.md`.

## Integrated dashboard

The main screen now uses the backend recommendation pipeline. Start fictional scenarios from **Demo incident**, select incidents from the queue, and assign a displayed candidate. See [frontend integration handoff](INTEGRATION.md) for tested behavior, live-provider evidence and remaining runtime dependencies. The `/debug` screen remains available for diagnostics.

Hospital markers and new simulated transport destinations use real facilities:

| Hospital | Address | Map coordinates (latitude, longitude) |
| --- | --- | --- |
| [Guthrie Lourdes Hospital](https://www.guthrie.org/locations/guthrie-lourdes-hospital) | 169 Riverside Drive, Binghamton, NY 13905 | 42.09204, -75.93631 |
| [UHS Binghamton General Hospital](https://www.nyuhs.org/location-search/uhs-binghamton-general-hospital) | 10–42 Mitchell Avenue, Binghamton, NY 13903 | 42.0881397, -75.9145967 |
| [UHS Wilson Medical Center](https://www.nyuhs.org/location-search/uhs-wilson-medical-center) | 33–57 Harrison Street, Johnson City, NY 13790 | 42.11425, -75.95851 |

Names and addresses were checked against the linked hospital websites on November 7, 2026. Lourdes coordinates come from its location page's geographic metadata; Binghamton General coordinates come from UHS's embedded directions link; Wilson's campus point comes from [OpenStreetMap via Mapcarta](https://mapcarta.com/22635144). These are campus map points, not verified ambulance entrances. Transport selection still uses the demo's nearest-hospital estimate. The hospital catalog refreshes in restored sessions and during development reloads; existing calls and accepted task destinations remain intact.

## Run

From `web/`, install with the pinned pnpm version and create `.env.local` from `.env.example` on first setup.

```bash
npm exec --yes --package=pnpm@10.34.9 -- pnpm install --frozen-lockfile
cp .env.example .env.local
./node_modules/.bin/next build
MODEL_MODE=mock ./node_modules/.bin/next start -p 3000
```

Run one combined app on port 3000 for the demo. Point the ElevenLabs tunnel at that process and configure its tool secret. Omit the inline `MODEL_MODE=mock` to use the serving profile in `.env.local`.

Use port 3001 only for isolated development in a separate worktree with its own state and environment. Check that the port is free before starting.

```bash
MODEL_MODE=mock ./node_modules/.bin/next dev -H 127.0.0.1 -p 3001
```

## Recommendation modes

Automatic updates debounce for 1.5 seconds. The scheduler runs one model request at a time. It publishes a deterministic fallback after four seconds in the queue or four seconds of inference. A valid current model response may replace it before the eight-second inference cutoff. Accepting a recommendation preserves the assignment if a model response arrives afterward.

`MODEL_MODE=mock` and `MODEL_MODE=fallback` use the deterministic demo rubric locally. To enable a provider, set `MODEL_MODE=model` and use one of these profiles in `.env.local`.

| Profile | `MODEL_PROVIDER` | `MODEL_BASE_URL` | `MODEL_NAME` and `MODEL_API_KEY` |
|---|---|---|---|
| Empire via SSH forward | `compatible` | `http://127.0.0.1:8000/v1` | Exact ID from the forwarded `/v1/models`. Supply a key if the server requires it. |
| MacBook compatible runtime | `compatible` | `http://127.0.0.1:8001/v1` | Exact ID from the local `/v1/models`. Supply a key if the runtime requires it. |
| OpenAI | `openai` | `https://api.openai.com/v1` | Explicit Chat Completions model that supports Structured Outputs, plus an OpenAI API key. |

Use `MODEL_RESPONSE_FORMAT=json_schema` by default. Compatible servers also support the explicit `json_object` and `text` modes. All modes validate model replies before publication. OpenAI uses [strict Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat). Restart the app after changing configuration. See [Serving](../model/SERVING.md) for the Empire forward. MacBook serving needs a compatible runtime and the intended served artifact.

## Checks

```bash
./node_modules/.bin/next typegen
./node_modules/.bin/tsx scripts/check-contracts.ts
./node_modules/.bin/tsx scripts/check-recommendations.ts
./node_modules/.bin/tsx scripts/check-dispatch-ui.ts
./node_modules/.bin/tsx scripts/check-dispatch-render.tsx
./node_modules/.bin/tsc --noEmit --incremental false
./node_modules/.bin/eslint
./node_modules/.bin/next build
./node_modules/.bin/tsx scripts/check-recommendations-http.ts
```

The recommendation checks use Python 3's standard library to generate the offline rubric oracle, a fake clock for scheduler races, and a local HTTP stub for both providers. Set `RUBRIC_MODEL_DIR` to a reference model directory to check a newer rubric and fixture. The HTTP check requires a disposable worktree with a free port 3001 and no existing `data/state.json`. It starts and restarts its own production app and removes the snapshot it creates.

## Model artifact handoff

The fallback was ported from the read-only model snapshot taken from `/Users/lukauljaj/nysairr` at commit `501874a1e4176030ff30d442b3d210b77b3cbce1`. The prompt, schemas, rubric, and serving documentation matched that commit. The shared checkout also had a newer 40-request demo fixture, verified separately from the committed 30-request fixture. Recheck the files below against the selected model commit and served artifact before integration.

| Reference | SHA-256 |
|---|---|
| `model/prompt.md` | `658a569706bee124a5211bb7051377b24bd21c6414e5c4a72be02086cf00434c` |
| `model/schemas/model-request.json` | `ccc121735e56a02a6385a7232cb72d91584f0527da668b6b1509c98abef9598e` |
| `model/schemas/model-response.json` | `ee9ba08f1eeaf9ddaff6b52e46960bbaeac89d476698fce8521c1432b41af29b` |
| `model/rubric.py` | `2977415bc8b08dd6d938068bc5d9640f39d361b0f50c005dbc9c2152b08c0b10` |
| `model/SERVING.md` | `a3b8c5de0f4953031f0a9705b78fa77d19b06e6dae6e6a64fc63532e530d7d07` |

The runtime logs the hash of the trimmed serving prompt.

On November 7, 2026, the isolated production app sent one live OpenAI Chat Completions request to `https://api.openai.com/v1` using `json_schema`. The configured model was `gpt-5.4-mini` and OpenAI reported `gpt-5.4-mini-2026-03-17`. The app validated the response in 2,156 ms, published a Delta recommendation for Medic 2 over SSE, and accepted it through the command API. The trimmed prompt hash was `03f60d550d02e820c79904b0719c2fc357d82b91ee08467f9c3ab64199cd7264`.

## Layout

```text
lib/contracts/   zod schemas + inferred types (single source); derive.ts = careLevel/crewComplete/selectable
lib/server/      store, commands, voice intake, scripted caller, ETA and recommendation pipeline
lib/client/      useDispatchState() SSE hook + sendCommand()
fixtures/        fleet.json (3 units, crew, hospitals), scenarios/*.json (scripted callers)
app/api/         events (SSE) · commands · voice/tools/{update-incident,get-assignment} · demo/{reset,scripted-call}
components/      DebugDashboard (placeholder until the real UI from plan/04)
```

## API quick reference

```bash
curl -N localhost:3000/api/events
curl -X POST localhost:3000/api/demo/scripted-call -H 'content-type: application/json' -d '{"scenario":"fall-unconscious"}'
curl -X POST localhost:3000/api/commands -H 'content-type: application/json' \
  -d '{"commandId":"<uuid>","type":"manual_assign","callId":"call-…","ambulanceId":"amb-2"}'
curl -X POST localhost:3000/api/voice/tools/update-incident -H "x-tool-secret: $VOICE_TOOL_SECRET" \
  -H 'content-type: application/json' -d '{"conversationId":"c1","locationText":"14 Riverside Dr","facts":{"conscious":false}}'
```

## Not built yet (TODOs in code)

- Mapbox routing and animated vehicle simulation. Assignment currently uses estimated ETA and phases advance through the manual control.
- Geocoding `locationText` → coords (scripted caller passes fixture coords).
- `move_queued_task` (stretch).

## Contract notes vs plan/01

- `Route.estimated: boolean` added (plan/02 says straight-line routes are flagged).
- State has `fleetRevision` (recorded on recommendation sets) and `hospitals`.
- `get-assignment` returns estimated minutes when known. Pending calls can return `missingFields`.
- `/api/commands` and `/api/demo/*` are unauthenticated; anyone with the tunnel URL can call them.

### Vehicle simulation

Assignments now start a shared server simulation automatically. Units follow road routes, stop on scene, transport to a hospital, then pick up queued calls. `SIM_SPEED` controls simulated seconds per real second (default 6); your existing `.env.local` value takes precedence. Run `pnpm simulation:check` for lifecycle regression checks. See [movement restoration](INTEGRATION.md#movement-and-map-restoration) for commit history and routing fallback behavior.

### Harpur’s Ferry home base

All three units use the squadroom on East Access Road beside Decker Student Health Services, at **42.0853645, -75.9646999**. Coordinates come from the station place pin in [Harpur’s Ferry’s contact map](https://harpursferry.org/contact); the [university resource listing](https://www.binghamton.edu/student-conduct/binghamton-student-code.pdf) identifies East Access Road. These are the station pin coordinates, not the map viewport center.

After completing or cancelling the last active job, a unit drives home using the same routing and simulation as incident trips. Queued calls take priority. Returning units remain available, and a new assignment interrupts the return from their current position. Return routes persist across restarts; existing snapshots receive the corrected home station automatically. At least two cars parked at base collapse into a squadroom button; open it to select an individual car.

### Staged fleet demos

Open demo controls with **⌘D / Ctrl+D** and choose a **Fleet** scenario:

- **Returning from hospitals:** two available units driving back to the squad room from Lourdes and Wilson, and Medic 3 on scene.
- **Mixed active incidents:** one available unit at the squad room, one transporting, and one on scene.
- **All busy with a queue:** units en route, transporting, and on scene, plus a queued job.

Starting a fleet scenario replaces the current demo, teleports the units into position, and begins a scripted incoming call. Staged jobs use the normal simulation, routes, dispatch and queue behavior. The original intake-only scenarios remain available. **Clear** cancels pending intake updates, removes incidents and tasks, and returns all three units to the squad room. Run `pnpm demo:check` to verify setup and cleanup.
