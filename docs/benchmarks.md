# Benchmark results and interpretation

## Main synthetic test set

| Model / pipeline | Exact acuity (300 cases) | Ambulance selection (264 eligible cases) |
|---|---:|---:|
| Base Qwen3-4B, r3-era rerun | 71.3% | 81.1% |
| GPT-5.4-mini | 85.7% | 88.6% |
| GPT-6 Luna | 88.0% | 90.2% |
| Qwen-4b-Dispatch, raw r3 | 91.7% | 94.3% |
| Qwen-4b-Dispatch + deterministic guardrails | 92.0% | 99.2% |

Raw-model values are backed by [archived per-case outputs](../model/benchmarks/2026-11-08-r3-comparison/results/) and the [comparison report](../model/benchmarks/2026-11-08-r3-comparison/README.md). The base row uses the r3-era rerun, not the earlier 69.7% baseline. Luna recommendation accuracy is 238/264 = 90.2% rounded directly; an earlier report rounded an already-rounded fraction to 90.1%.

The combined pipeline values are recorded in the November 8, 04:23 entry of [STATUS.md](../model/STATUS.md). Its per-case run report is not committed in this checkout. These values have not been independently rescored here. They must not be represented as raw model results.

## Other splits

| Pipeline | Paraphrase acuity (150) | Paraphrase selection (150) | Demo acuity (40) | Demo selection (35) |
|---|---:|---:|---:|---:|
| Raw r3 | 93.3% | 93.3% | 92.5% | 94.3% |
| Model + deterministic guardrails | 90.0% | 98.7% | 92.5% | 97.1% |

The serving notes report all 490 combined-pipeline responses as schema-valid. Structured validity does not establish decision correctness. The paraphrase set intentionally emphasizes keyword-rule disagreements; demo cases are curated presentation scenarios.

## What is measured

Acuity scoring includes correctly returning `needs_more_info`. Ambulance-selection denominators include only reference cases requiring a recommendation. The raw-model comparisons use the same scenarios and full rubric prompt, with guided/strict structured output. GPT runs have reasoning disabled and a transport schema wrapper removed before scoring.

The combined pipeline was evaluated in a separate inference run. Its middleware retains predicted acuity and recomputes fleet ranking; the small acuity difference is between runs, not an acuity improvement caused by the guardrail.

Training targeted observed evaluation failures. Although evaluation rows were not used as training examples, repeated development against these results reduces test independence. A fresh holdout is needed to measure final generalization. These are synthetic rubric labels, not clinical ground truth, patient outcomes, or evidence of reduced emergency response time.

Infrastructure and concurrency differ across runs. Do not use these tables to make like-for-like latency or cost claims. Earlier r1 charts in `submission/assets/` are explicitly provisional historical artifacts; use this table for the selected r3 model.
