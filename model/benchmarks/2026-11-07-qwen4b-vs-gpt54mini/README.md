# Saved benchmark: Qwen 4B base, fine-tuned r1, and GPT-5.4-mini

Snapshot dated November 7, 2026 (America/New_York). Results are from the completed r1 comparison, not subsequent Qwen training runs. No new inference was run to create this archive.

Fine-tuned Qwen achieved higher exact acuity and recommendation accuracy on all three splits. GPT-5.4-mini was faster. All three systems produced 100% schema-valid outputs.

## Accuracy and latency

| Split | Model | Cases | Exact acuity | Recommendation | p95 latency |
|---|---|---:|---:|---:|---:|
| test | qwen_base | 300 | 69.7% | 81.8% | 3.280 s |
| test | qwen_finetuned_r1 | 300 | 88.3% | 89.0% | 3.146 s |
| test | gpt54mini | 300 | 85.7% | 88.6% | 1.268 s |
| paraphrase | qwen_base | 150 | 77.3% | 85.3% | 3.343 s |
| paraphrase | qwen_finetuned_r1 | 150 | 94.0% | 92.7% | 3.192 s |
| paraphrase | gpt54mini | 150 | 88.0% | 90.0% | 1.320 s |
| demo | qwen_base | 40 | 62.5% | 82.9% | 3.336 s |
| demo | qwen_finetuned_r1 | 40 | 90.0% | 94.3% | 3.214 s |
| demo | gpt54mini | 40 | 77.5% | 91.4% | 1.376 s |

## Measured GPT cost

Calculated from recorded usage at standard rates: $0.75/M uncached input tokens, $0.075/M cached input tokens, and $4.50/M output tokens. [Official OpenAI pricing](https://developers.openai.com/api/docs/models/gpt-5.4-mini). These are usage-based estimates, not an invoice; taxes, regional uplifts and account-specific discounts are excluded.

| Split | Cases | Total GPT cost | Mean cost per request |
|---|---:|---:|---:|
| test | 300 | $0.588744 | $0.001962 |
| paraphrase | 150 | $0.300671 | $0.002004 |
| demo | 40 | $0.078158 | $0.001954 |
| **Total** | **490** | **$0.967573** | **$0.001975** |

One case means one model inference, not an entire incident or voice call. Re-triage invokes the model again. Costs exclude transcription, voice, mapping and the rest of the application. Smoke tests are excluded from the 490-case total.

## Qwen costs and savings

Our Qwen deployment is self-hosted on an Empire AI H100 MIG 1g.10gb slice under a hackathon reservation. It incurs no model API fee. No billed hourly rate is documented, so total Qwen cost and net savings are unknown. If the reservation is already covered with no incremental charge, the avoided GPT API spend below is also the incremental cash saving. It is not evidence that production hosting is free.

| Requests at the measured workload mix | GPT API spend / gross avoided API cost |
|---:|---:|
| 1 | $0.001975 |
| 1,000 | $1.974639 |
| 10,000 | $19.746395 |
| 100,000 | $197.463949 |
| 1,000,000 | $1974.639490 |

Net savings = avoided GPT API spend − incremental Qwen hosting − amortized training − other incremental operating costs.

For a server billed at R dollars/hour serving q requests/hour: Qwen hosting cost/request = R/q. Count idle paid hours too. Break-even throughput = R / 0.001974639 requests/hour, excluding training and operations.

Illustration only, not a provider quote: at $0.50/hour, Qwen needs about 253 requests/hour to break even. Keeping that server on for 720 hours costs $360/month, requiring about 182,312 requests/month to beat the measured GPT API spend. At 10,000 requests/month GPT would cost $19.75, so a dedicated $360/month server would cost more.

The r1 training loop recorded 2.017 hours on one slice. At the hypothetical $0.50/hour rate, that loop costs $1.01; this excludes setup, verification, smoke runs, idle time, evaluation, and later experiments. Training is a one-time cost to amortize, not a per-request API fee.

## Method and limits

- Same 300 test, 150 paraphrase and 40 demo requests, labels, full rubric prompt and scorer. Saved row IDs were checked against archived inputs for all three models.
- Qwen base and r1 use vLLM guided decoding and a 600-token cap. GPT uses gpt-5.4-mini-2026-03-17, reasoning=none, strict JSON schema, a result envelope removed before scoring, and a 600-token cap.
- Latency uses sequential requests: Qwen through the laptop SSH tunnel; OpenAI over the internet. Hardware and service infrastructure differ.
- Labels come from a synthetic demo rubric, not clinical ground truth. Base Qwen filtered the generated bank; paraphrases were selected for keyword-rule disagreements.
- These are single-run results, not repeated-trial confidence estimates. Future prompts, reasoning settings, output lengths and cache hit rates change cost and quality.
- Baseline files predate the new hashing harness; current prompt and evaluator snapshots are retained, and prior Qwen outputs were rescored successfully in the comparison task.

## Saved evidence

- `results/`: nine original full result files (including outputs, metrics and GPT token usage) plus GPT manifests.
- `inputs/`: evaluated requests and labels, prompt, schema, and reference scorer/client snapshots. Reference Python files depend on the repository and are not a standalone package.
- `summary.json`: all aggregate metrics, cost calculations, training duration and SHA-256 hashes.
- `per-request-costs.json`: token counts and cost for each of the 490 GPT requests.

This directory is outside gitignored runs/. It is available for version control; saving it does not commit or push it.
