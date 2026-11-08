# Model status

## Nov 7, ~19:45 (hour ~6.5)

**Works:** rubric (`rubric.py`), system prompt (`prompt.md`), generator (`data/generate.py`: 3,000 / 300 / 300, split by complaint family, every example verified against the rubric, number grounding and ≤ 20-word reasons), 30 hand-checked demo cases (`fixtures/demo/`), eval harness (`eval/evaluate.py`), SLURM scripts (`cluster/`). Rules baseline on test: acuity 100 % (it is the rubric), recommendation 96.9 %; it misses all 9 experience-exception cases, which is the gap the fine-tune has to close.

**Rubric change (please read, Luka):** `conscious == null` plus "not answering / unresponsive / won't wake" → `needs_more_info` (Echo words still win). Without it, the demo line "My dad fell down the stairs, he's not answering me" came out Bravo instead of "Gathering details".

**Cluster:** logged in (2FA done), shared SSH connection working. Login node has internet; no home quota. Installing train/serve envs and downloading Qwen3-4B-Instruct-2507 on the login node.

**Constraint:** one slice is 10 GB, so training is QLoRA (4-bit base) and serving is FP8 vLLM. Latency on a 1/7 H100 is the main risk to the 2 s gate.

**Next:** serve base on slice 1 → base eval; 50-step QLoRA smoke test on slice 2 → full run.

## Nov 7, 19:45 (hour ~6.8)

**plan/07 (paraphrase robustness) mostly implemented:** labels come from concept sets, not keywords (`rubric.acuity_of(facts, sig)`); concept-labelled phrasing bank (`data/bank.py`, written by Claude: no external LLM API is configured, so this is the plan/07 fallback; an API key would allow more variety); held-out slang/indirect wordings; `paraphrase` split; base Qwen as second-pass verifier (running).

**Luka: `prompt.md` changed** (judge by meaning, ignore negations, structured fields win, new unconscious / may-be-unresponsive rows). The backend must read it verbatim.

**Backend note:** vLLM rejects `uniqueItems` in guided-decoding schemas; strip it before sending (SERVING.md).

**Cluster:** base Qwen3-4B (FP8) serving on alphagpu01:8000 (job 175721, until ~01:31). QLoRA smoke test: ~21 s/step at effective batch 16, loss 1.9 → 0.17 in 25 steps; a full 2-epoch run is ≈ 2.5 h.

**Next:** see HANDOFF.md §3.

## Nov 7, ~20:05 (hour ~7)

**New per user request: the model explains its acuity.** Ready responses get a required `acuityReason`, written before `acuity` (e.g. "Unconscious after a fall (conscious = false), so Delta; ALS required."). Every training reason is generated from the same rule as the label and code-checked. **Luka: contract change in `CONTRACT_CHANGES.md`** (zod field, UI line under the acuity chip, consistency check). `prompt.md` changed again.

**Rubric in the weights:** 30% of training rows use a one-line system prompt without the rubric; serving and main evals keep the full prompt. A `--short-prompt` eval will show whether the definitions were learned.

**Data final:** train 3000 / val 300 / test 300 / paraphrase 150, concept-labelled, verified by base Qwen (drop 8–20%; verifier is weak on negations, documented in HANDOFF.md).
