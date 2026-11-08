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
