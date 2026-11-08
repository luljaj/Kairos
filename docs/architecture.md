# Architecture

Kairos runs as one long-lived Next.js Node process. The backend owns incident, fleet, recommendation, and assignment state; the browser subscribes through server-sent events. State snapshots are stored in `web/data/state.json` (ignored by Git).

## Intake and recommendations

ElevenLabs sends structured incident updates to `/api/voice/tools/update-incident` with the `x-tool-secret` header. The tool must send `intakeComplete: true` when information gathering finishes. Intermediate updates do not trigger assessment. `/api/voice/tools/get-assignment` exposes assignment or pending information to the voice agent. See the Zod contracts in `web/lib/contracts/` for exact payloads.

After intake, the backend prepares candidate eligibility and arrival estimates and calls the configured model. Model responses must satisfy the response schema and semantic checks: candidate IDs belong to the request, coverage is complete, and the explanation agrees with the selected acuity.

The scheduler publishes a local rule-based fallback after four seconds of queueing or inference. A valid model reply can replace the fallback before the eight-second inference cutoff, provided the inputs are still current and the recommendation has not been accepted. Changes to facts or fleet state invalidate stale recommendations. Assignment commands recheck current state before applying mutations.

## Deterministic guardrails

`model/serving/rank_dispatch.py` is optional vLLM middleware enabled by `SERVE_RANK_CANDIDATES=1` in `model/cluster/serve.sbatch`.

For a valid ready response, it preserves Qwen’s acuity, acuity explanation, and incident summary. It then calls `rubric.recommend` using the supplied candidates and the predicted acuity, replacing `recommendedAmbulanceId`, candidate suitability, order, and candidate explanations.

The prototype rubric selects an appropriate care level and considers arrival time. For Delta/Echo incidents, its experience exception can favor a suitable crew chief with at least 24 additional months of service when arrival is within 60 seconds of the fastest suitable crew. These are project-defined demonstration rules, not a validated clinical protocol.

The guardrail is more than output validation: it can overwrite the model’s ambulance choice. It does not correct a mistaken acuity assessment. A dispatcher still approves or overrides the resulting recommendation. Report this pipeline’s performance separately from raw Qwen output.

This layer differs from `MODEL_MODE=fallback` or `mock`, which uses the local keyword/structured-field rubric for the whole assessment. A fallback result is not evidence that Qwen ran.

## Fleet and UI

Mapbox supplies the map and road-routing integration. A server simulation moves fictional units through travel, scene, transport, queue, and return-to-base phases. Arrival estimates include availability and travel context. The map is not connected to operational ambulance tracking.

The dashboard uses the same backend state as voice tools and assignment commands. A late model result cannot replace an accepted assignment.

## Scope

This is a local hackathon prototype. Demo/command APIs are not a production access-control boundary; the ElevenLabs tool secret authenticates voice tools only. Real deployment would require operational integration, access controls, caller-data handling, and evaluation with dispatch professionals.
