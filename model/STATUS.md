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

## Nov 7, 20:15 EST — training handoff resumed

The `r1` QLoRA run (Slurm 175750) is training on the verified 3,000 examples. The laptop and cluster hashes match for the training code, prompt and data splits. The demo set now has 40 cases, including 10 paired rewordings that reuse the original structured facts and expected decisions. All 40 reference responses pass the schema and grounding checks.

The original 30-case guided base benchmark reached 63.3% exact acuity and 3.43 s p95 from the cluster login node. The final comparison uses the laptop SSH tunnel and the expanded demo set. The keyword fallback reaches 56.3% acuity on held-out test and 80.0% on the expanded demo. The paraphrase challenge set was deliberately selected for keyword disagreements.

`ModelResponseReady` in `web/lib/contracts/model.ts` already requires `acuityReason` before `acuity` and validates that the reason names the chosen level.

## Nov 7, 21:58 EST — 4B training complete

Slurm 175750 completed both epochs in 376 steps at 19.3 s/step and 3.85 GB peak GPU allocation. The last 100-example validation loss was 0.0621. The saved adapter reloaded on a fresh base and returned a schema-valid Delta with the expected recommendation. The adapter, checkpoints, and run provenance are in `runs/r1/`.

Base Qwen over the laptop tunnel reached 69.7% exact acuity on test, 77.3% on paraphrase and 62.5% on the 40-case demo. Guided p95 was 3.28–3.34 s across the three splits. Unguided demo p95 was 3.33 s with 95% schema validity. The adapter is being evaluated on the same serving path.

## Nov 7, 22:09 EST — speed fallback started

The served 4B adapter on `alphagpu02:8000` (job 175922) scored 90% acuity, 94.3% recommendation and 100% schema validity on the 40-case demo. Both experience-exception recommendations went to the faster unit. Guided p95 was 3.21 s and unguided p95 was 3.07 s. The held-out test, paraphrase, and short-prompt evaluations are in progress.

Slurm 175933 is training `r2-1p7b` on the same data on the other slice. This run uses a BF16 base for LoRA and the non-thinking chat template.
