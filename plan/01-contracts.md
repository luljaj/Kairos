# 01 — Contracts

Single source: zod schemas in `web/lib/contracts/`. TypeScript types are inferred from them. The model request and response are exported to `model/schemas/*.json` (JSON Schema) for the Python side. Shared fixtures in `web/fixtures/` must validate in both.

## Conventions

- Stable string IDs (`call-…`, `amb-…`, `crew-…`, `task-…`, `rec-…`). Entities reference each other by ID.
- UTC ISO-8601 timestamps. Durations in seconds. Coordinates as `{ lat, lng }`.
- Unknown is `null`, never `0` or `""`. Unknown durations stay `null` all the way to the UI ("ETA unknown").
- Every entity has `revision: number`, incremented on each change. The store has a global `revision` too (see 02).

## Acuity scale

Field name: `acuity`. UI label: **Suggested acuity (MPDS-style, unofficial)**.

| Value | Meaning in this demo |
|---|---|
| `Echo` | Immediately life-threatening (e.g. not breathing) |
| `Delta` | Serious, likely life-threatening |
| `Charlie` | Serious, needs advanced care, not immediately life-threatening |
| `Bravo` | Urgent, basic care |
| `Alpha` | Non-urgent, basic care |

Wording to show once in the UI footer and say in the pitch: *"Acuity letters are styled after the MPDS determinant levels familiar to local dispatchers. This demo does not implement the licensed IAED protocol; the mapping is a simplified demo rubric."* Omega is not used. The rubric used for training lives in 05.

The incident's acuity has a source: `{ value, source: "model" | "fallback" | "dispatcher", setAt }`. A dispatcher override is never replaced by later model output.

Care level required by acuity (used by eligibility, see 02): `Echo, Delta, Charlie → ALS`; `Bravo, Alpha → BLS`.

## Call (incident)

```ts
Call {
  id, revision
  conversationId: string | null      // ElevenLabs conversation, null for manual/scripted
  callerNumber: string | null
  status: "intake" | "awaiting_decision" | "assigned" | "closed"
  location: { text: string | null, coords: {lat,lng} | null, confidence: "confirmed" | "approximate" | null }
  facts: IncidentFacts               // see below
  factsRevision: number              // bumps only on meaningful fact/location changes
  summary: string | null             // model or agent summary
  acuity: { value: Acuity, source, setAt } | null
  recommendationSetId: string | null // latest
  taskId: string | null              // accepted task
  transcript: { role: "agent" | "caller", text, at }[]   // optional, may stay empty
  createdAt, updatedAt
}
```

### IncidentFacts — DRAFT, friend to confirm

```ts
IncidentFacts {
  chiefComplaint: string | null      // caller's words, short
  patientCount: number | null
  patientAge: number | null
  patientSex: "male" | "female" | "other" | null
  conscious: boolean | null
  breathingNormally: boolean | null
  severeBleeding: boolean | null
  chestPain: boolean | null
  traumaMechanism: string | null     // fall, crash, assault…
  hazards: string | null             // fire, traffic, violence
  callerRelation: "self" | "family" | "bystander" | "other" | null
  notes: string | null
}
```

`factsRevision` bumps when any field above or `location.coords` changes value. Transcript and summary changes do not bump it. The model is re-run only on `factsRevision` changes.

## CrewMember

```ts
CrewMember { id, name, role: "driver" | "crew_chief" | "attendant",
             qualifications: Qualification[], monthsOfService: number }
Qualification = "nys_emt" | "nys_aemt" | "nys_paramedic" | "hf_driver_cleared" | "hf_crew_chief_cleared" | "hf_als_cleared"
```

These are app labels, not official agency codes.

## Ambulance

```ts
Ambulance {
  id, revision, name
  position: {lat,lng}
  status: "available" | "busy" | "out_of_service"
  crewIds: string[]
  activeTaskId: string | null
  queuedTaskIds: string[]            // order lives here only
  homeStation: {lat,lng}
}
```

Derived by the backend, not stored: `careLevel: "ALS" | "BLS"` (ALS if any crew member has both `nys_paramedic` and `hf_als_cleared`), `crewComplete` (has a `hf_driver_cleared` driver and a `hf_crew_chief_cleared` crew chief).

## Task

```ts
Task {
  id, revision, callId, ambulanceId
  status: "queued" | "active" | "completed" | "cancelled"
  phase: "en_route" | "on_scene" | "transporting" | "completed" | null   // null while queued
  acuityAtAcceptance: Acuity | null
  hospital: { name, coords } | null
  route: { geometry: [lng,lat][], durationSeconds, distanceMeters } | null
  phaseEndsAt: string | null         // simulation timer
  etaAt: string | null               // arrival at scene
  acceptedFromRecommendationId: string | null
  override: { reason: "dispatcher_choice" | "capability_mismatch_confirmed", note: string | null } | null
  createdAt, updatedAt
}
```

Proposals are not Tasks. They live inside the RecommendationSet until accepted. Cancelling a queued task removes it from `queuedTaskIds`; cancelling an active task frees the unit and starts its next queued task.

## RecommendationSet

```ts
RecommendationSet {
  id, callId, factsRevision, fleetRevision, createdAt
  source: "model" | "fallback"
  modelId: string | null             // e.g. "qwen3-4b-base" or adapter name
  status: "ready" | "needs_more_info" | "error" | "stale"
  acuity: Acuity | null
  summary: string | null
  missingFields: (keyof IncidentFacts | "location")[]
  recommendedAmbulanceId: string | null
  candidates: Candidate[]            // backend order: eligible by arrival, then mismatched, then unavailable
  latencyMs: number | null
}

Candidate {
  ambulanceId
  // backend facts
  availableInSeconds: number | null  // current + queued work
  travelSeconds: number | null       // from projected release point
  arrivalInSeconds: number | null
  careLevel: "ALS" | "BLS"
  selectable: boolean                // false if out_of_service or crew incomplete
  unavailableReason: string | null
  capabilityMismatch: boolean        // set after acuity is known
  // model judgement
  crewSuitable: boolean | null
  reason: string | null
}
```

`status: "stale"` is set when `factsRevision` or fleet changes after creation; the UI shows it greyed with a "Refreshing…" note.

## Model request (backend → model)

```json
{
  "requestId": "req-…",
  "incident": { "location": {"text": "…", "confidence": "confirmed"}, "facts": { "…": "IncidentFacts" } },
  "candidates": [
    {
      "ambulanceId": "amb-2",
      "careLevel": "ALS",
      "crew": [{ "role": "crew_chief", "qualifications": ["nys_paramedic","hf_als_cleared","hf_crew_chief_cleared"], "monthsOfService": 41 }],
      "availableInSeconds": 0,
      "travelSeconds": 312,
      "arrivalInSeconds": 312
    }
  ]
}
```

Only selectable candidates are sent (1–3; the fleet is always 3 ambulances). No transcripts, names or coordinates.

## Model response (model → backend)

```json
{
  "status": "ready",
  "acuity": "Delta",
  "summary": "Adult male, unconscious after fall, breathing.",
  "recommendedAmbulanceId": "amb-2",
  "candidates": [
    { "ambulanceId": "amb-2", "crewSuitable": true,  "reason": "ALS crew, arrives in about 5 minutes." },
    { "ambulanceId": "amb-1", "crewSuitable": false, "reason": "BLS only; patient is unconscious." }
  ]
}
```

```json
{ "status": "needs_more_info", "acuity": null, "missingFields": ["conscious", "breathingNormally"], "reason": "Cannot assess without consciousness and breathing status." }
```

Backend validation: every `ambulanceId` must be one of the sent candidates, each exactly once, all covered; `recommendedAmbulanceId` must be among them; `acuity` in the enum. If the model recommends a unit that is not the fastest suitable one, its `reason` must say why; the UI shows both "Fastest" and "Recommended". Invalid output → fallback result with `source: "fallback"`.

## Voice tool payloads (ElevenLabs → backend)

`POST /api/voice/tools/update-incident`

```json
{ "conversationId": "…", "callerNumber": "+1…", "locationText": "…", "facts": { "…partial IncidentFacts" } }
```

Returns `{ "ok": true, "callId": "call-…" }`. Partial updates merge; `null` in the payload means "caller said unknown", an omitted key means "not discussed".

`POST /api/voice/tools/get-assignment`

```json
{ "conversationId": "…" }
```

Returns one of:

```json
{ "state": "pending", "sayHint": "A dispatcher is reviewing now.", "missingFields": [] }
{ "state": "pending", "sayHint": "Help is being arranged. I need a couple more details.", "missingFields": ["conscious", "breathingNormally"] }
{ "state": "assigned", "unitName": "Medic 2", "etaMinutes": 6, "queued": false }
{ "state": "assigned", "unitName": "Medic 3", "etaMinutes": 14, "queued": true }
```

`missingFields` is copied from the call's latest recommendation when its status is `needs_more_info` (empty otherwise), so the agent knows which question unblocks the model. See [03-voice-intake.md](03-voice-intake.md#what-the-model-needs-from-the-call) for how each fact must be captured.

Both require header `x-tool-secret: $VOICE_TOOL_SECRET`.
