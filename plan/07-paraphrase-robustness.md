# 07 — Make the model understand calls, not keywords (brief for the training agent)

From Luka, Nov 7. This changes how training data is labelled and worded. It must land **before the full training run**. The deadline in [05](05-model-finetune.md) is unchanged: a served adapter passing the gate by hour 18.

## The problem

Right now every label comes from `rubric.signals()`, which matches keywords against the complaint text, and every complaint comes from the fixed phrasings in `data/families.py`. The fine-tune therefore learns the keyword list, blind spots included. Checked with `rubric.acuity_of` (conscious, nothing else set):

- `"car crash"` → Alpha
- `traumaMechanism: "thrown out of the car"` → Alpha (only "ejected" counts)

Real input won't use our words. The voice agent ([03](03-voice-intake.md)) writes `chiefComplaint` / `traumaMechanism` / `notes` as short plain-language summaries of what the caller said. The model has to judge priority from the **meaning** of that text.

## What stays the same

- The acuity categories and their order (rows 0–5 in `prompt.md`): what counts as Echo / Delta / Charlie / Bravo / Alpha / needs_more_info. These are concepts, not word lists.
- Required care level, suitability, recommendation and the experience exception: unchanged, deterministic.
- Schemas, response format, ≤ 20-word reasons, number grounding.
- `rubric.signals()` (keyword version) stays as the **rules baseline / backend fallback**. It just stops being the labeller.

## Changes

### 1. Label from the scenario, not the text

- The generator picks a **concept set** first (for example `{major_trauma}`, `{chest_pain, chest_extra}`, `{unresponsive_hint}`, `{}` for vague), along with the structured facts. The acuity label comes from that concept set plus the facts.
- Refactor: `acuity_of(facts, signals=None)`. When `signals` is given, use it instead of matching the text. The generator passes the concept set; the rules baseline and fallback keep calling it without `signals`.
- Store the concept set in each example's `meta`.

### 2. Write the text with an LLM, in many ways

- For each sampled scenario, have a strong LLM write `chiefComplaint` (and `traumaMechanism` / `notes` where the concept needs them) so the text conveys **exactly** that concept set: nothing more severe, nothing missing.
- Two styles, about half each:
  - the voice agent's summary style ("Father fell down the stairs, not answering");
  - caller's raw words ("he just came off the ladder, like 20 feet, he's not moving right").
- Include, deliberately:
  - synonyms and slang ("thrown from the car", "can't catch her breath", "lips going grey", "he's out cold", "keeled over", "pills", "sugar crash");
  - indirect descriptions ("fell from the roof" vs "came off the top of the house");
  - **negations and resolved symptoms** ("was choking but it came out, talking fine now", "no chest pain", "breathing fine") — these must *not* raise acuity;
  - scary-sounding minor things ("fell off a chair", "small cut, lots of blood on the shirt but it stopped");
  - two complaints in one sentence (highest one wins);
  - transcription noise: missing punctuation, filler words, the odd misspelling.
- If no LLM API is reachable from the login node, tell Luka at once; a key can be provided. Interim fallback: hand-expand each family to 15–25 varied phrasings and still label by concept (step 1). That alone fixes the main problem.

### 3. Verify with a second check

- A second LLM pass (different prompt; ideally a different model) reads only the generated text and answers "which concepts does this describe?". Keep the example only if that matches the intended concept set. Log the drop rate.
- Keep the existing code checks: schema, ids, number grounding, ≤ 20 words.
- Conflict rule (write it into `prompt.md` too): **structured fields win over text.** If `conscious: true` but the text says "passed out earlier", go by `conscious: true` and the current state.

### 4. Rubric decisions to apply

- Car crash / collision, conscious, no major-mechanism details → **Bravo** (injury, possible fracture). With high speed / highway / rollover / thrown from the vehicle / hit by a vehicle → Delta.
- Thrown / ejected from a vehicle → major trauma (Delta).
- Add the obvious synonyms to the keyword `LEX` too, so the fallback is less brittle: "thrown from", "crash", "collision", "car accident", "can't catch", "passed out", "out cold", "unconscious". Labels no longer depend on this list, so it's a baseline improvement only.

### 5. Prompt

- In `prompt.md`, describe each row as a concept with a few varied examples, and say explicitly to judge by meaning, including synonyms and negations. Keep it short (it's prefix-cached and counts toward the token budget).
- The prompt must stay identical for base and fine-tuned. The backend reads it verbatim, so after editing just tell Luka it changed.

### 6. Splits and eval

- Split by family as now, **and** hold out a set of paraphrase styles / synonyms entirely from training (e.g. all "slang" and "indirect" wordings for some concepts).
- New eval set `paraphrase` (~150): the expected acuity is clear from meaning, but `rubric.signals()` gets it wrong or settles it differently. Build it by generating and keeping the cases where the keyword baseline disagrees with the concept label (after the verifier agrees).
- Add 10 paraphrased versions of the demo fixtures to the demo set (e.g. "my dad took a tumble down the stairs and won't talk to me").
- Report on `test`, `paraphrase` and `demo`, for base / fine-tuned / rules. **Added gate:** fine-tuned acuity exact on `paraphrase` ≥ 85 % and clearly above rules. The existing gates stay.
- In the results file, keep the sentence that the labels come from a synthetic rubric.

## Time budget

- Regeneration should take ≤ 2 h of wall time. Run the 50-step smoke test on the current data meanwhile; it measures memory and speed only, so it doesn't need the new data.
- If the new data isn't ready by ~hour 10, train on what exists, still build and report the `paraphrase` set, and tell Luka.
- Append progress to `model/STATUS.md` as usual.
