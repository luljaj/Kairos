# New Qwen r3 versus prior Qwen and OpenAI benchmarks

Snapshot: November 8, 2026. r3-4b is the latest completed run with full results. A read-only cluster check found r5-4b training (Slurm 176291); no r5 evaluation files existed at comparison time. No training or serving jobs were modified.

## Acuity accuracy

| Set | Cases | Qwen base | Qwen r1 | Qwen r3 (new) | GPT-5.4-mini | GPT-6 Luna |
|---|---:|---:|---:|---:|---:|---:|
| test | 300 | 71.3% | 88.3% | 91.7% | 85.7% | 88.0% |
| paraphrase | 150 | 77.3% | 94.0% | 93.3% | 88.0% | 89.3% |
| demo | 40 | 62.5% | 90.0% | 92.5% | 77.5% | 82.5% |

## Ambulance recommendation accuracy

| Set | Qwen base | Qwen r1 | Qwen r3 (new) | GPT-5.4-mini | GPT-6 Luna |
|---|---:|---:|---:|---:|---:|
| test | 81.1% | 89.0% | 94.3% | 88.6% | 90.1% |
| paraphrase | 83.3% | 92.7% | 93.3% | 90.0% | 91.3% |
| demo | 85.7% | 94.3% | 94.3% | 91.4% | 94.3% |

## What changed

r3 continues training from r1 on 3,940 examples, adding independently checked plain-language contrasts, 300 fleet pairs near experience-rule boundaries, and shorter candidate reasons. The original held-out test, paraphrase and demo sets remain unchanged.

- Test acuity: 88.3% → 91.7% (+3.4 percentage points using rounded scores). Recommendation: 89.0% → 94.3% (+5.3 points).
- Demo acuity: 90.0% → 92.5%. Recommendation remains 94.3%.
- Paraphrase acuity: 94.0% → 93.3% (one fewer correct case). Recommendation: 92.7% → 93.3%.

## Needs-more-info and remaining failures

| Model | Test precision | Test recall | Test experience-exception recommendation |
|---|---:|---:|---:|
| Qwen base (r3 evaluation) | — | 0.0% | 30.0% |
| Qwen fine-tuned r1 | 70.6% | 100.0% | 0.0% |
| Qwen fine-tuned r3 (new) | 94.4% | 94.4% | 0.0% |
| GPT-5.4-mini | 71.4% | 41.7% | 40.0% |
| GPT-6 Luna | 70.0% | 38.9% | 70.0% |

r3 improves needs-more-info precision from 70.6% to 94.4%, while recall decreases from 100% to 94.4%. It is substantially more reliable on this behavior than mini or Luna in these runs.

r3 still misses the 95% recommendation quality gate on test and demo (both 94.3%). It gets 0% of the test/demo experience-exception recommendations correct. The newer r5 training is intended to address this. Latency is excluded from model selection as requested in the model status notes.

## Full GPT-5.4: completed demo only

The user cancelled full GPT-5.4 after 40 demo and 55 test cases. No new GPT-5.4 calls were made. Its completed demo split is comparable; its partial test is excluded from the full-set tables.

| Model | Demo cases | Acuity | Recommendation |
|---|---:|---:|---:|
| Qwen r3 | 40 | 92.5% | 94.3% |
| GPT-5.4 full | 40 | 92.5% | 100.0% |

## Fairness checks and interpretation

- Verified identical dataset hashes for all three splits against the mini manifests; verified the r3 training prompt hash against the current prompt, and the trimmed prompt hash against mini. Matched all request IDs and order. Rescored all 490 r3 outputs with the current evaluator; every saved row metric matched.
- r3 uses guided decoding, full rubric prompt and concurrency 4. Prior OpenAI and r1 runs were sequential; do not compare latency as if the load were identical. GPT runs use reasoning=none and strict JSON with a transport wrapper. All compared main runs have 100% schema-valid output.
- Base Qwen here is the rerun stored with r3, so its measured scores differ slightly from the original r1 base benchmark.
- Test is the main 300-case held-out mix; demo is 40 curated presentation cases; paraphrase is 150 cases selected for keyword-rule disagreements. These are synthetic rubric scores, not clinical ground truth.
- Repeated development against these evaluation results reduces their independence. A fresh untouched holdout would be needed to establish generalization for the final selected model.
- Full r5 results are not available; this report makes no claim about r5. All source outputs are saved in results/, with aggregates and paired correctness counts in summary.json.

No additional API spend was incurred for this comparison. Previously measured API costs are in [the Luna comparison](../2026-11-08-luna-comparison/README.md). Qwen hosting costs remain separate from API fees.
