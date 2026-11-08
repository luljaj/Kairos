# Contract change proposals (model → Luka)

## 1. `acuityReason` on ready responses (Nov 7, ~20:00) — requested by the user

**Change:** `ModelResponse.Ready` gains a required string `acuityReason` (1–200 chars), placed **before** `acuity`.
Already in `model/schemas/model-response.json` and `schemas/examples/response.delta.json`.

```json
{"status":"ready",
 "acuityReason":"Unconscious after a fall down stairs (conscious = false), so Delta; ALS required.",
 "acuity":"Delta", "summary":"…", "recommendedAmbulanceId":"amb-2", "candidates":[…]}
```

**Why:** the model writes the deciding fact and the rubric row before choosing the letter (it generates in order),
which tends to make the label more accurate, and the dispatcher sees *why* the acuity was suggested. Every
training reason is generated from the same concept/rule that produced the label and checked by code
(it must name the same level as `acuity`; numbers must appear in the input).

**Backend / UI:**
- zod: add `acuityReason: z.string().min(1).max(200)` to the ready variant; keep key order if you build the JSON Schema from zod (guided decoding follows schema property order, and the reason must come first).
- RecommendationSet: store it (e.g. `acuityReason: string | null`); show it as a one-line note under the acuity chip ("Why: …").
- Fallback: the rules fallback can fill it the same way (`model/eval/evaluate.py::rules_system` shows the templates), or set it to `"Rules fallback: <rule name>"`.
- Semantic check to add: `acuityReason` mentions the same level as `acuity`; otherwise treat the response as invalid → fallback.
- `needs_more_info` is unchanged (it already has `reason`).
