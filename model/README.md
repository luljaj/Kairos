# model/ — fine-tuned dispatch judgement model

**Taking over mid-hackathon? Start with [HANDOFF.md](HANDOFF.md).**

**Read first:** [../plan/05-model-finetune.md](../plan/05-model-finetune.md) is your full brief (task, rubric, data, training, serving, eval gate, deadlines). Background: [../plan/01-contracts.md](../plan/01-contracts.md) and [../plan/00-overview.md](../plan/00-overview.md) (fleet is always 3 ambulances).

You own everything in this folder. Don't edit `web/` or `plan/`; if the contract needs changing, write the proposal in `model/CONTRACT_CHANGES.md` and tell Luka.

## Layout

```text
schemas/
  model-request.json        # backend -> model (JSON Schema 2020-12)
  model-response.json       # model -> backend
  examples/                 # valid request/response pairs (Delta case, needs_more_info case)
rubric.py                   # TO CREATE: single source of labels (acuity, suitability, recommendation)
prompt.md                   # TO CREATE: system prompt, identical for base and fine-tuned
data/
  generate.py               # TO CREATE: scenario generator
  generated/                # gitignored output: train/val/test jsonl
fixtures/demo/              # TO CREATE: ~30 hand-checked demo scenarios (eval only, never train)
training/                   # LoRA training scripts and configs
eval/                       # evaluation scripts (base vs fine-tuned vs rule fallback)
serving/                    # vLLM launch scripts
runs/<run-id>/              # gitignored: config, data hash, adapter, eval.md
SERVING.md                  # TO CREATE: endpoint + model name the backend should use
```

## Schemas

The JSON Schemas here are **canonical for now**: the TypeScript (zod) contracts in `web/` don't exist yet and will be written to match these files. Response uses `anyOf` with a `status` const so vLLM guided decoding can consume it.

The schema checks shape only. Your eval and the backend must also check: every `ambulanceId` is from the request, each exactly once, all covered, and `recommendedAmbulanceId` is one of them.

Quick check that examples still validate after edits:

```bash
python -I -c "import json; from jsonschema import Draft202012Validator as V; rq=json.load(open('schemas/model-request.json')); rs=json.load(open('schemas/model-response.json')); [V(rq).validate(json.load(open(f'schemas/examples/request.{n}.json'))) or V(rs).validate(json.load(open(f'schemas/examples/response.{n}.json'))) for n in ['delta','needs-more-info']]; print('ok')"
```

## Status reports

Append to `model/STATUS.md` at hours 6, 12 and 18: what works, what's blocked, GPU/serving details.

## OpenAI model comparisons

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
