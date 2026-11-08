# Four-model benchmark comparison

Saved November 8, 2026 (America/New_York). Luna run began November 7; earlier baselines were measured November 7. Qwen baseline is the completed r1 run, not later training runs.

Test (300) is the main held-out mix of scenarios. Demo (40) is a curated presentation set including 10 reworded cases. Paraphrase (150) is a wording challenge deliberately selected for disagreement between keyword rules and concept labels. None of these sets was used for training; all use synthetic rubric labels rather than clinical ground truth.

## Accuracy and latency

| Split | Model | N | Acuity | Recommendation | Schema valid | p50 | p95 |
|---|---|---:|---:|---:|---:|---:|---:|
| test | Qwen 4B base | 300 | 69.7% | 81.8% | 100.0% | 2.740s | 3.280s |
| test | Qwen 4B fine-tuned r1 | 300 | 88.3% | 89.0% | 100.0% | 2.457s | 3.146s |
| test | GPT-5.4-mini | 300 | 85.7% | 88.6% | 100.0% | 1.054s | 1.268s |
| test | GPT-6 Luna | 300 | 88.0% | 90.1% | 100.0% | 1.775s | 2.230s |
| paraphrase | Qwen 4B base | 150 | 77.3% | 85.3% | 100.0% | 2.698s | 3.343s |
| paraphrase | Qwen 4B fine-tuned r1 | 150 | 94.0% | 92.7% | 100.0% | 2.687s | 3.192s |
| paraphrase | GPT-5.4-mini | 150 | 88.0% | 90.0% | 100.0% | 1.083s | 1.320s |
| paraphrase | GPT-6 Luna | 150 | 89.3% | 91.3% | 100.0% | 1.831s | 2.438s |
| demo | Qwen 4B base | 40 | 62.5% | 82.9% | 100.0% | 2.890s | 3.336s |
| demo | Qwen 4B fine-tuned r1 | 40 | 90.0% | 94.3% | 100.0% | 2.836s | 3.214s |
| demo | GPT-5.4-mini | 40 | 77.5% | 91.4% | 100.0% | 1.073s | 1.376s |
| demo | GPT-6 Luna | 40 | 82.5% | 94.3% | 100.0% | 1.578s | 1.885s |

## API costs

| Model | 490 requests | Per request | Per 1,000 |
|---|---:|---:|---:|
| GPT-5.4-mini | $0.9676 | $0.001975 | $1.97 |
| GPT-6 Luna | $0.0657 | $0.000134 | $0.13 |

Cache hit rates differ between runs. For comparison, pricing every input token at the ordinary uncached rate (no cache reads or writes) gives:

- GPT-5.4-mini: $0.9698 for 490 requests, or $1.98 per 1,000.
- GPT-6 Luna: $0.1252 for 490 requests, or $0.26 per 1,000.

Costs use recorded input, cached input and output tokens at standard rates. GPT-6 Luna: $0.10/$0.01/$0.50 per million tokens, plus the $0.025/M premium on cache-write input tokens (total write rate $0.125/M); mini: $0.75/$0.075/$4.50. Smoke tests excluded. These are estimates, not invoices.

Pricing: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [GPT-5.4-mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini).

Qwen has no model API fee in this self-hosted setup. Net savings require subtracting hosting, amortized training and operations; the cluster's billed rate is unknown. Covered hackathon compute does not establish free production hosting.

## Needs-more-info behavior

| Split | Model | Precision | Recall |
|---|---|---:|---:|
| test | Qwen 4B base | — | 0.0% |
| test | Qwen 4B fine-tuned r1 | 70.6% | 100.0% |
| test | GPT-5.4-mini | 71.4% | 41.7% |
| test | GPT-6 Luna | 70.0% | 38.9% |
| paraphrase | Qwen 4B base | — | — |
| paraphrase | Qwen 4B fine-tuned r1 | 0.0% | — |
| paraphrase | GPT-5.4-mini | 0.0% | — |
| paraphrase | GPT-6 Luna | 0.0% | — |
| demo | Qwen 4B base | — | 0.0% |
| demo | Qwen 4B fine-tuned r1 | 100.0% | 100.0% |
| demo | GPT-5.4-mini | 100.0% | 60.0% |
| demo | GPT-6 Luna | 100.0% | 60.0% |

## Method and limits

Same 490 held-out requests, full rubric prompt, schema and scoring. Both GPT runs use reasoning=none, strict structured outputs with a result envelope removed before scoring, a 600-token cap, and sequential requests. GPT settings differ only by model. No prompt tuning on these evaluation sets.

Qwen uses vLLM guided decoding on one H100 MIG 1g.10gb slice via the laptop SSH tunnel; OpenAI uses its API over the internet. Latencies reflect different hardware and serving paths. First requests included. Recorded finish reasons reveal any token-cap truncation.

Labels come from a synthetic demo rubric, not clinical ground truth. Base Qwen filtered the generated bank, paraphrases were selected for keyword-rule disagreements, and demo cases were curated. These are single-run measurements, not proof of real-world superiority.

Raw outputs and metrics for all four models are under results/. Inputs, labels and reference code are under inputs/ (code snapshots depend on the repository). summary.json holds metrics, rates and hashes; per-request-costs.json holds 980 individual GPT usage records. Original three-model archive is preserved. Files are saved outside gitignored runs/; not committed or pushed.
