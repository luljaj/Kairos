# Ambulance dispatch assistant — overview

Updated: November 7, 2026 (hackathon: November 7–8)

This replaces the single `___plan.md`. Each file below is one part that one owner (or the training agent) can work from without reading the others, except where noted.

| File | What it covers | Owner |
|---|---|---|
| [01-contracts.md](01-contracts.md) | Entities, acuity scale, model request/response, voice tool payloads | Luka (friend reviews intake fields) |
| [02-state-and-backend.md](02-state-and-backend.md) | Server-authoritative state, commands, ETA, eligibility, simulation, model client | Luka |
| [03-voice-intake.md](03-voice-intake.md) | ElevenLabs phone agent, server tools, hold/confirm behaviour, fallback caller | Friend |
| [04-dashboard.md](04-dashboard.md) | Next.js UI, map, cards, dispatch pill | Friend |
| [05-model-finetune.md](05-model-finetune.md) | Self-contained brief for the training agent | Agent |
| [06-schedule-and-demo.md](06-schedule-and-demo.md) | Hour-by-hour plan, demo script, fallbacks, pitch | Both |
| [08-recommendation-pipeline.md](08-recommendation-pipeline.md) | Backend implementation and local app / Empire or MacBook model integration | Luka |

## Scope (unchanged)

A dispatcher is busy with one call. A second caller reaches a real phone number; an ElevenLabs agent gathers details while a live incident card fills in. The backend combines the incident with fictional fleet/crew data and computed arrival estimates. A model suggests an acuity level and a recommended ambulance with short reasons. The dispatcher approves or overrides. The accepted task starts or joins a busy unit's queue, the agent tells the caller the estimated arrival, and the dashboard tracks the simulated ambulance.

Fictional fleet and crew; simulated assignments; no Harpur's Ferry operational integration. This is a demo, not a clinical dispatch protocol. Reduced workload and faster decisions are hypotheses to measure, not results.

## Changes from `___plan.md`

1. **State is server-authoritative.** The Next.js server holds state in memory and saves a JSON snapshot to disk. The browser is a view. Browser IndexedDB, snapshot exchange on connect and reconnect reconciliation are removed. Details in 02.
2. **Split of responsibilities.** The backend computes arrival estimates, hard eligibility and capability mismatches, and a default order. The model gives judgement only: acuity suggestion, crew suitability notes, a recommended unit and its reasons. A deterministic fallback produces the same response shape when the model is down.
3. **Terminology.** "EMD" (emergency medical dispatch) is the discipline and the person, not the level. The level is the **acuity level**, shown as "Suggested acuity (MPDS-style, unofficial)". Alpha–Echo letters are kept because local dispatchers and judges recognise them; the app states it does not implement the licensed IAED MPDS protocol, and Omega is not used. Details in 01.
4. **Stack.** One Next.js app (App Router, TypeScript) contains both the UI and the backend route handlers, run as a single long-lived Node process. Python lives only in `model/`.
5. **Fine-tuning is parallel and non-blocking.** An agent owns it (05). The demo works on prompted base Qwen or the deterministic fallback; the fine-tuned adapter replaces them through configuration if it passes its evaluation gate.
6. **Riskiest work first.** The voice round trip and model serving are spiked in the first three hours (06).

## Fleet

Exactly **three ambulances** exist at all times; none are added or removed during a run (a unit can still be `out_of_service`). Fixture:

| Unit | Care level | Station | Role in demo |
|---|---|---|---|
| Medic 1 | BLS | closest to the demo incident | fastest, but under-qualified for serious calls |
| Medic 2 | ALS | mid-distance | the expected recommendation for the main call |
| Medic 3 | ALS | farther | busy on the first (scripted) call; used to show queueing |

## Repository layout

```text
web/                          # Next.js app (UI + backend)
  app/
    page.tsx                  # dashboard
    api/
      events/route.ts         # SSE stream of state snapshots
      commands/route.ts       # POST dispatcher commands
      voice/tools/*/route.ts  # ElevenLabs server-tool webhooks
      demo/*/route.ts         # reset, scripted caller
  components/                 # UI
  lib/
    contracts/                # zod schemas + TS types (single source)
    server/                   # store, commands, eta, eligibility, sim, model client
  fixtures/                   # fleet, crews, scenarios, mock model responses
  data/state.json             # runtime snapshot (gitignored)
model/                        # agent-owned Python: data, training, eval, serving
  schemas/                    # JSON Schema exported from web/lib/contracts
plan/                         # these documents
```

## Decisions made here (open to challenge)

| Decision | Choice | Why |
|---|---|---|
| State authority | Server memory + JSON file | Calls arrive at the server; one process, one writer, no sync protocol |
| Live updates to browser | Server-Sent Events, full snapshot on each change | Fleet is always 3 units; full snapshots avoid patch bugs; SSE works in Next.js route handlers, WebSockets do not without a custom server |
| Hosting | Laptop running `next start` + Cloudflare Tunnel (or ngrok) for ElevenLabs webhooks | Vercel's serverless functions lose in-memory state and drop long connections |
| Schemas | zod in `web/lib/contracts`, exported to JSON Schema for Python | One source; Python only needs the model request/response |
| Map + routing | Mapbox GL JS + Mapbox Directions (one token) | One provider for tiles, geometry and durations; free tier is enough |
| Package manager | pnpm | — |
| Acuity labels | Alpha–Echo, labelled MPDS-style and unofficial | Recognisable; honest |
| Capability mismatch | Shown and selectable, requires a confirm click | Matches original "advisory" intent while making overrides deliberate |
| Unavailable units | Out-of-service or incomplete crew: not selectable | These are facts, not judgement |
| Model judgement beyond rules | For Echo/Delta, may prefer a unit ≤ 60 s slower whose crew chief has ≥ 24 more months of service (confirmed by Luka) | Gives the fine-tune something to learn that the fallback doesn't do; illustrative, not clinical |
| Model serving | vLLM OpenAI-compatible endpoint, LoRA adapter loaded by name | The backend client is the same for base and fine-tuned models |

## Still open

- Exact intake fields: friend to confirm or change the draft in 01.
- Whether ElevenLabs phone calls can reach server tools mid-call in our account setup (spike, hour 0–3).
- Model inference: Empire AI Alpha over an SSH port forward, or a compatible MacBook server if the trained artifact and local runtime pass verification. The Next.js app stays on the laptop. Empire uses a `1g.10gb` H100 MIG slice with a six-hour job limit; details in 05 and the integration plan in 08.
- Demo acuity rubric in 05 needs a human read-through; it is simplified and not clinical.
