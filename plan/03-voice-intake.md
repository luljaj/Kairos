# 03 — Voice intake (ElevenLabs phone agent)

Owner: friend. Backend endpoints are defined in [01-contracts.md](01-contracts.md#voice-tool-payloads-elevenlabs--backend) and served by Luka's code. The model that consumes what this agent collects is described in [05-model-finetune.md](05-model-finetune.md); its exact rules are `model/prompt.md` and `model/rubric.py`.

## Goal

A caller dials the demo number. The hosted ElevenLabs agent collects location and incident facts, sends them to the backend as it learns them, keeps the caller company while the dispatcher decides, then tells them which unit is coming and roughly when.

## Spike first (hours 0–3)

Prove one round trip before building anything else:

1. Phone number attached to the agent (ElevenLabs native or Twilio integration — whichever the account supports).
2. Agent has a **server tool** (webhook) `update_incident` pointed at `https://<tunnel>/api/voice/tools/update-incident` with header `x-tool-secret`.
3. During a real call, the agent calls the tool and the backend logs the payload.
4. The backend can identify the conversation. Check which system dynamic variables are available on phone calls (conversation ID, caller ID) and pass them as tool parameters.
5. Check that a nested `facts` object with boolean / integer / enum fields arrives intact (types, not strings like `"true"` or `"67"`). If nested objects are awkward in the tool editor, flatten the fields to the top level and tell Luka; the backend can map them.

Report back: does it work on phone calls, what latency per tool call, what the conversation ID looks like. If server tools are not available on phone calls, stop and tell Luka; the fallback is the scripted caller below and the plan changes.

## What the model needs from the call

The model only sees the structured `facts` and `locationText` the agent sends. It never sees the transcript. If a fact is not in a tool call, it does not exist for the model. The backend's fallback uses the same rules, so this applies to it too.

The acuity rubric works in two ways:

- **Structured fields**: `conscious`, `breathingNormally`, `severeBleeding`, `chestPain`, `patientAge`.
- **Words** in `chiefComplaint`, `traumaMechanism` and `notes`. The rules match plain caller language ("not breathing", "can't breathe", "fell off the roof", "confused"). Clinical paraphrases do not match ("apnoeic", "dyspnoea", "syncope", "LOC", "MVC", "AMS"). **Write what the caller said in their own words**, shortened, never translated into medical terms.

### Field rules

| Field | Type sent | How to fill it |
|---|---|---|
| `chiefComplaint` | string | Caller's own words, ≤ ~20 words, third person or first person as said ("My dad fell down the stairs, he's not answering"). **Each update replaces the old value**, so when a new symptom comes up, resend the whole complaint with the new words added ("…chest pain and he's sweating"). |
| `conscious` | boolean | `true` only if the caller says they are awake / talking / responding. `false` only if the caller confirms they won't respond to voice or touch. "Not answering me" alone is **not** `false`: ask. If the caller is the patient, send `true`. |
| `breathingNormally` | boolean | `true` if breathing normally. `false` for any abnormal breathing (struggling, gasping, wheezing, very fast, not breathing). Also put the caller's words for *how* they breathe into `chiefComplaint` (see below). |
| `severeBleeding` | boolean | `true` only for heavy bleeding that won't stop / spurting / soaking through. Minor or controlled bleeding is `false`, and say "bleeding" or "cut" in `chiefComplaint`. |
| `chestPain` | boolean | `true` if any chest pain, pressure or tightness; `false` if the caller denies it. |
| `patientAge` | integer | Number of years. "About 70" → `70`. "Elderly" or "a teenager" → leave it out. Ask for it whenever chest pain is mentioned. |
| `patientSex` | `"male"` \| `"female"` \| `"other"` | Only if stated or clear from "my dad / my wife". |
| `patientCount` | integer ≥ 1 | Only if asked or stated. |
| `traumaMechanism` | string | How the injury happened, with the caller's specifics: height ("fell from the roof", "fell from the third floor", "fell from standing"), vehicle ("rollover on the highway", "hit by a car"), "ejected", "assaulted". |
| `hazards` | string | Scene dangers only: fire/smoke, traffic, violence, dog, ice. |
| `callerRelation` | `"self"` \| `"family"` \| `"bystander"` \| `"other"` | Roommate, coworker, neighbour, carer → `"other"`. |
| `notes` | string | Practical extras: door code, floor, on blood thinners, pregnant, language. Medical symptoms go in `chiefComplaint`, not here. |

**Unknowns:** if the caller doesn't know, **leave the field out**. The backend stores unsent fields as unknown, which is exactly what the model treats as unknown. Send `null` only to retract something said earlier ("actually I'm not sure he's breathing") — and only if the spike showed ElevenLabs can send `null`; otherwise just send the corrected value when known.

### Questions that change the outcome

The agent must be able to ask these when relevant, because each one moves the acuity or the unit type (ALS vs BLS):

| If the caller mentions… | Ask | Why (rubric) |
|---|---|---|
| anything | Awake? Breathing normally? | Both unknown and a vague complaint ("collapsed", "not well") → model returns **Gathering details** instead of a suggestion. |
| "not answering", "won't wake" | "Do they respond if you talk to them or touch their shoulder?" | With `conscious` unknown this always stops at **Gathering details**. Unconscious → Delta; unconscious and not breathing → Echo. |
| breathing problems | "Can they speak in full sentences? Are they gasping or turning blue?" | "can't breathe / gasping / struggling / turning blue" → Delta; "short of breath / wheezing / asthma" → Charlie. Put those words in `chiefComplaint`. |
| choking | "Can they cough, talk or breathe at all?" | Choking with no air ("can't breathe", "can't talk", "turning blue") → Echo; choking otherwise → Delta. |
| not breathing / no pulse / CPR | Confirm and record the words. | Echo. Keep "not breathing" / "no pulse" / "doing CPR" in `chiefComplaint`. |
| chest pain | Age. "Any sweating, nausea or vomiting, pain in the arm or jaw, dizziness, or shortness of breath?" | Chest pain + age ≥ 35 + any of those → Delta, otherwise Charlie. Add the symptoms to `chiefComplaint`. |
| a fall | "How far did they fall?" | Roof / 3+ storeys / scaffolding → Delta; otherwise fall → Bravo. |
| a crash | "Was it a fast or highway crash, or did the car roll over?" (one question; if the caller volunteers that someone was thrown out or hit by a car, record it) | High-speed / highway / rollover / ejected / hit by a vehicle → Delta. Write "ejected" in `traumaMechanism` for "thrown out" (the rubric only matches "ejected"). |
| bleeding | "Is it bleeding heavily or spurting, and can you stop it with pressure?" | `severeBleeding: true` → Delta; otherwise Bravo. |
| odd behaviour | "Are they confused, slurring, not making sense?" | Altered mental status → Charlie. |
| seizure, diabetes / blood sugar, overdose / pills | Awake? Breathing? Record the words. | Charlie (overdose only while conscious; unconscious → Delta). |

### Keep it short: question budget

The table above is a lookup, not a checklist. A good call sounds like a calm dispatcher, not a form:

- **Core, every call (4):** address, what happened, awake, breathing. Skip any the caller already answered ("he's breathing but won't wake up" answers two).
- **Follow-ups: at most 2**, and only from the row that matches what the caller said. A fall gets "how far?"; it does not get the chest-pain or bleeding questions.
- **One question per turn**, in plain words. The chest-pain symptoms are one question ("Any sweating, sickness, or pain in the arm or jaw?"), not five.
- **Stop asking once the answer can't change anything.** Echo already (not breathing, CPR): no more follow-ups, just address check and reassurance. Already Delta and ALS: skip the remaining severity questions.
- **Never re-ask** something answered, and don't ask about hazards, sex or patient count unless the caller hints at them.
- **More questions only when the backend asks:** `missingFields` from `get_assignment`, or filler while waiting for the dispatcher (age, access, door code). Filler is better than silence, but use at most one question per wait cycle.

A typical call is 5–6 questions. The demo call ("fell down the stairs, not answering") is: address → what happened → "does he respond if you talk to him or touch him?" → "is he breathing normally?" → "how old is he?" → wait.

### Model "Gathering details"

When the model can't decide, the latest recommendation is `needs_more_info` and `get_assignment` returns `pending` with `missingFields` (for example `["conscious", "breathingNormally"]`). Ask about those fields first, send the answers with `update_incident`, then call `get_assignment` again. Any new fact makes the backend re-run the model.

## Tool definitions (ElevenLabs)

`update_incident` (POST, header `x-tool-secret`). Parameter descriptions are what the agent's LLM reads, so paste the field rules above into them.

```text
conversationId   string   dynamic variable (system conversation ID)       required
callerNumber     string   dynamic variable (system caller ID)             optional
locationText     string   address as read back to the caller              optional
facts            object   optional; only keys the caller actually stated:
  chiefComplaint   string    caller's own words, full updated complaint
  patientCount     integer
  patientAge       integer
  patientSex       enum      male | female | other
  conscious        boolean
  breathingNormally boolean
  severeBleeding   boolean
  chestPain        boolean
  traumaMechanism  string
  hazards          string
  callerRelation   enum      self | family | bystander | other
  notes            string
```

`get_assignment` (POST, header `x-tool-secret`): `conversationId` only. Returns `pending` (`sayHint`, `missingFields`) or `assigned` (`unitName`, `etaMinutes` — may be `null` — and `queued`).

## Agent behaviour

Opening: identify as an automated assistant for the demo dispatch centre, say a human dispatcher is overseeing, ask for the address first.

Order of questions:

1. Address / location. Read it back. Call `update_incident` as soon as there is an address.
2. What happened (chief complaint), in the caller's words. Call `update_incident`.
3. Is the person awake and responding? Breathing normally? Call `update_incident`. If the caller is the patient, skip "awake" (send `conscious: true`).
4. At most two follow-ups from [Questions that change the outcome](#questions-that-change-the-outcome), only from the row matching the complaint (see [question budget](#keep-it-short-question-budget)). Age if it matters (chest pain) or comes up naturally. Call `update_incident` after each answer that changes something.
5. Then call `get_assignment`.

Rules:

- Send only fields the caller actually stated. Never infer `conscious: false` or `breathingNormally: false` without the caller confirming it.
- Keep the caller's words in the text fields; never use medical abbreviations or clinical terms.
- Never give medical instructions beyond "stay with them, keep the line open" (out of scope; liability). This includes CPR instructions on an Echo call.
- Never promise a time before `get_assignment` returns `assigned`.
- Never say the acuity letter or which unit the model suggests; the dispatcher decides.
- If the caller describes something that sounds immediately life-threatening, tell them help is being arranged now and keep collecting the essentials (awake, breathing, address).

## Waiting for the dispatcher

`get_assignment` returns `pending` until the dispatcher accepts. Prompt the agent to:

- if `missingFields` is not empty, ask about those fields first (most important first), update, then call `get_assignment` again;
- otherwise say the `sayHint` once, ask a further useful question from the table above (age, hazards, access), then call `get_assignment` again;
- retry roughly every 10–15 s of conversation, up to ~2 minutes;
- after the limit, say a dispatcher will call back on this number, and end politely (demo only).

When `assigned`: "Medic 2 is on the way, about 6 minutes." If `queued: true`: "The nearest suitable unit is finishing another call; it should reach you in about 14 minutes." If `etaMinutes` is `null`: "Medic 2 is on the way; I don't have an arrival time yet." Then ask whether they want the agent to stay on the line. If yes, keep chatting with reassurance and allow further `update_incident` calls (a worsening condition, e.g. stopped breathing, must still be sent); if no, end the call.

## Scripted caller fallback (must exist before the demo)

`POST /api/demo/scripted-call { scenario: "fall-unconscious" }` replays a fixture of timed `update-incident` payloads through the same code path as the real tool, with the transcript filled from the fixture. Used for:

- developing the dashboard without phoning,
- the busy-dispatcher first call,
- the stage backup if the phone or Wi-Fi fails.

The fixtures in `web/fixtures/scenarios/` follow the field rules above and are a good reference for what the agent should send.

## Transcript

Optional. The incident card must not depend on it. If the post-call webhook or a live transcript source is easy to wire, append to `call.transcript`; otherwise leave the expander hidden.

## Done when

- A real phone call creates and fills an incident card within ~3 s of each answer.
- The demo line "My dad fell down the stairs, he's not answering me" shows **Gathering details** until the agent asks and sends `conscious` / `breathingNormally`, then a Delta suggestion.
- A chest-pain test call with age and a second symptom ("he's 60, chest pain, sweating") comes out Delta; without the symptom, Charlie.
- Accepting on the dashboard leads the agent to say the unit and ETA on the same call.
- Queued case says the longer wait.
- The scripted caller runs the same scenario with no phone.
