# 06 — Schedule, demo script and fallbacks

Hour 0 = when building starts (Nov 7). Adjust to the real submission deadline once known.

## Schedule

| Hours | Luka (backend) | Friend (voice + UI) | Agent (model) |
|---|---|---|---|
| 0–3 | Scaffold `web/` (Next.js, pnpm, zod contracts, fixtures); store + SSE + commands skeleton | **Voice spike**: phone → server tool → backend log | Confirm GPU access (2FA, `1g.10gb` slice); scenario generator + rubric |
| 3–8 | Candidates, routing + cache, fallback, mock model, sim loop | Dashboard shell: cards, map, fleet list against mock mode | Base Qwen served (FP8, slice 1); data generated; QLoRA smoke train (slice 2) |
| 8–12 | Model client, stale handling, queueing, scripted caller | Dispatch pill, alternatives, crew panel; `get_assignment` loop in agent | Full fine-tune; status report |
| 12–16 | **Integration**: real call end to end; fix | Integration; polish card states | Eval vs base vs fallback |
| 16–18 | Swap in fine-tuned model if gate passes | Demo controls, footer, reset | Serving on reachable URL (SSH forward) |
| 18–20 | **Feature freeze.** Rehearse ×3, fix only demo-breaking bugs | Rehearse | Final eval write-up |
| 20–end | Slides, record backup video | Slides | — |

Checkpoint at hour 3: if the voice spike failed, the demo uses the scripted caller with a recorded voice clip; tell everyone and continue.

## Demo script (~3 min)

1. **Setup (20 s).** Dashboard with the 3 units. A scripted first call is in progress and Medic 3 is already assigned to it — the dispatcher is "on it".
2. **Second call (60 s).** A teammate dials the number on speaker. The agent asks the address; the card appears. Caller: "My dad fell down the stairs, he's not answering me." Card fills; "Gathering details" while consciousness/breathing are asked; then the acuity suggestion and pill.
3. **Decision (40 s).** Pill: Medic 2, Delta, 6 min, ALS crew. Open alternatives: Medic 1 is 4 min but BLS — warning. Click Send ambulance.
4. **Caller loop closes (20 s).** On speaker the agent says Medic 2 is coming in about 6 minutes and asks to stay on the line.
5. **Busy unit (30 s).** A scripted third call (Charlie) arrives. Only BLS Medic 1 is free; Medic 2 and Medic 3 are busy. Accept ALS Medic 3 — it queues with the wait shown.
6. **Close (20 s).** Human decides every dispatch; model output never overrides a dispatcher choice; numbers from the eval table.

## Fallbacks

| Failure | Fallback |
|---|---|
| Phone / ElevenLabs | Scripted caller + pre-recorded audio of the agent |
| Model server (slice pool full, 6 h job ended, tunnel down) | `MODEL_MODE=fallback` — same UI, source tag shows "fallback". Resubmit the serving job Sunday ~09:00 so it covers judging |
| Mapbox routing | Straight-line estimates, marked "estimated" |
| Wi-Fi | Phone hotspot; pre-warmed route cache; backup video |
| Laptop | Backup video |

## Pitch points

- **Responsibility:** human approves every dispatch; acuity is labelled unofficial; unknowns stay visible; fictional data; no medical advice from the agent.
- **Technical depth:** live voice → structured incident; deterministic ETA/eligibility separated from model judgement; fine-tuned 4B model with a measured comparison to base and rules.
- **Real-world impact:** a second caller gets answered and a decision is prepared while the dispatcher is busy. Say it's a hypothesis; show time-to-decision from rehearsal, not a claimed result.

## Rehearsal checks

- Busy-unit queue, mismatch confirm, acuity override, denied/alternative choice, changed incident mid-call, `needs_more_info`.
- No model update changes an accepted assignment.
- Reset between runs takes < 5 s.
- Startup order written in `README.md`: tunnel → `pnpm start` → check `/api/events` → model URL → ElevenLabs tool URL updated.
