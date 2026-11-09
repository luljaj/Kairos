# Qwen-4b-Dispatch

Fine-tuned dispatch assessment model based on `Qwen/Qwen3-4B-Instruct-2507`.

Training is complete and the hackathon cluster endpoint has stopped. Download the saved adapters, checkpoints, datasets and run records from the [training artifact archive](ARTIFACTS.md), which also explains restoration and the selected `r3-4b` model.

- [Training stack and experiment history](../docs/training.md)
- [Benchmark methodology and selected results](../docs/benchmarks.md)
- [Serving configuration](SERVING.md)
- [Guardrail behavior](../docs/architecture.md#deterministic-guardrails)
- [Historical run log](STATUS.md)

## Layout

| Directory / file | Purpose |
|---|---|
| `data/` | Concept-labelled scenario generation, verification, and follow-up preparation |
| `training/` | QLoRA SFT, adapter reload checks, and optional merge |
| `cluster/` | Slurm training, evaluation, and vLLM serving scripts |
| `serving/` | Optional deterministic fleet-ranking middleware |
| `eval/` | Scoring, reports, model comparisons, and archived provenance |
| `benchmarks/` | Saved inputs, per-case outputs, and comparison reports |
| `schemas/` | Model request and response JSON Schemas |
| `fixtures/demo/` | Evaluation-only demo scenarios |
| `prompt.md` | Runtime system prompt used by training and inference; keep this file |
| `rubric.py` | Prototype labels, fleet rules, and keyword baseline |
| `runs/` | Local/generated run artifacts; weights are not bundled |

The selected pipeline uses r3 for acuity and a deterministic guardrail for fleet ranking. Keep raw adapter and combined-pipeline metrics separate. The dispatcher makes the final assignment.

Responses require both schema and semantic validation: candidate IDs must match the request, appear exactly once, and include the recommended ID. The acuity explanation must agree with the acuity level. See [contract notes](CONTRACT_CHANGES.md).

## OpenAI model comparisons

Selected raw Qwen comparison: [r3 versus base Qwen, r1, GPT-5.4-mini, Luna, and the completed full GPT-5.4 demo](benchmarks/2026-11-08-r3-comparison/README.md).
That archive predates completion of r5. The selected adapter remains r3; see [training history](../docs/training.md).

Latest: [GPT-6 Luna, GPT-5.4-mini, and both Qwen baselines](benchmarks/2026-11-08-luna-comparison/README.md),
including 490-case results, cache-aware costs, raw outputs and the test/demo/paraphrase definitions.

Saved results for base Qwen 4B, fine-tuned Qwen 4B r1, and GPT-5.4-mini,
including per-request costs and hosting break-even assumptions:
[November 7 benchmark archive](benchmarks/2026-11-07-qwen4b-vs-gpt54mini/README.md).

From the repository root, run:

```bash
model/.venv/bin/python -I model/eval/compare_openai.py
```

Select another supported model with `--model gpt-6-luna` or `--model gpt-5.4`.
Each model gets its own output directory and pricing. The GPT-5.4 run was cancelled
at the user's request; its partial outputs are not a completed benchmark.
Luna's cost includes reported cache-write tokens at the applicable write rate.

This evaluates the same 40 demo, 300 test and 150 paraphrase cases as the saved
fine-tuned Qwen 4B `runs/r1/eval-ft-*.json` results. It uses the full rubric prompt,
strict schema decoding, no reasoning tokens and four concurrent requests by default.
Use `--concurrency 1` for sequential latency comparisons. The OpenAI
schema requires a transport wrapper, which is removed before scoring. Both models
use a 600-token output cap. Credentials come from `OPENAI_API_KEY` / `MODEL_API_KEY`
in the environment, or `web/.env.local`; use `--env-file` to select another file.
Credentials are never included in saved artifacts.

Default parallel outputs go to `model/runs/gpt54mini-vs-r1-c4/` (sequential runs
retain `model/runs/gpt54mini-vs-r1/`), including `comparison.md`, raw scored
responses, token usage and configuration/data hashes. Repeating the command resumes
saved rows; changed inputs require a fresh `--out` directory. API failures stop the
run rather than being reported as model mistakes. For a smoke test use `--limit 1`
with a separate `--out` directory. These are synthetic rubric benchmarks, not a
measure of clinical correctness. Latencies compare the actual serving paths, which
use different infrastructure.

## Faster evaluation

Both `eval/evaluate.py` and `eval/compare_openai.py` default to `--concurrency 4`.
The Qwen server is configured for four concurrent sequences. Keep the full prompt,
schema and held-out splits for accuracy comparisons; parallel per-request latency
must not be compared directly with the saved sequential latency baseline.
Use `--concurrency 1` when measuring sequential latency.

For an initial Qwen smoke test from the repository root:

```bash
model/.venv/bin/python -I model/eval/evaluate.py --system http --guided \
  --data model/fixtures/demo/demo.jsonl --limit 20 --skip-latency \
  --out model/runs/parallel-smoke/eval-ft-demo.json
```

Supply `--base-url` if the server is not at `http://localhost:8000/v1`.
Remove `--limit` for the full split and use a separate output file per split and
configuration. `--skip-latency` retains quality scoring without the latency gate.
OpenAI comparisons checkpoint in input order and resume completed prefixes;
configuration changes require a fresh output directory. On API failure, no new
work is submitted, though up to four requests may already be in flight.
