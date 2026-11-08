# web/ — dispatch assistant (UI + backend)

One Next.js 16 app (App Router, TypeScript), run as **one long-lived Node process**. State lives in server memory and is snapshotted to `data/state.json` (gitignored). Plans: `../plan/01-contracts.md`, `../plan/02-state-and-backend.md`.

## Run

```bash
pnpm install
cp .env.example .env.local   # fill in tokens
pnpm build && pnpm start     # demo laptop; `pnpm dev` also works (store is a globalThis singleton)
```

Startup order on demo day: tunnel (`cloudflared tunnel --url http://localhost:3000`) → `pnpm start` → check `/api/events` → model URL → update the ElevenLabs tool URL.

## Scripts

| Script | What it does |
|---|---|
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm contracts:check` | Parses `model/schemas/examples/*`, `model/fixtures/demo/demo.jsonl` and `web/fixtures/*` with the zod contracts |
| `pnpm contracts:export` | Writes JSON Schema from zod to `lib/contracts/json/` for diffing against `model/schemas/` (does not touch `model/`) |

## Layout

```text
lib/contracts/   zod schemas + inferred types (single source); derive.ts = careLevel/crewComplete/selectable
lib/server/      store (singleton, mutate, persist, command dedupe), commands, incidents, voice, scripted caller
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

- Recommendation pipeline (`request_recommendation` returns `not_implemented`): candidates, model client / fallback / mock, debounce, apply.
- Routing (Mapbox + straight-line fallback + cache), sim loop (`simClock`, `phaseEndsAt`, `etaAt`, movement). `advance_phase` works manually.
- Geocoding `locationText` → coords (scripted caller passes fixture coords).
- `move_queued_task` (stretch).

## Contract notes vs plan/01

- `Route.estimated: boolean` added (plan/02 says straight-line routes are flagged).
- State has `fleetRevision` (recorded on recommendation sets) and `hospitals`.
- `get-assignment` `etaMinutes` is `number | null` until ETAs exist; `pending` carries `missingFields`.
- `/api/commands` and `/api/demo/*` are unauthenticated; anyone with the tunnel URL can call them.
