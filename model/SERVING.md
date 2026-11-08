# Serving — how the backend reaches the model

The selected `r3-4b` adapter is live as `qwen3-4b-dispatch-lora` on `alphagpu02:32291` (Slurm 176520, scheduled to end at 08:42 EST on Nov 8). Its ranked endpoint passed the test, paraphrase and demo quality gates. See [the evaluation](runs/r3-4b/eval.md) for raw adapter and served results.

The adapter predicts the call's acuity, explanation and summary. The serving layer applies `rubric.recommend` to that predicted acuity and the supplied fleet. It sets crew suitability, the recommended ambulance and the candidate reasons, including the experience exception.

## Backend env vars

```bash
MODEL_MODE=model
MODEL_BASE_URL=http://127.0.0.1:8000/v1
MODEL_NAME=qwen3-4b-dispatch-lora
MODEL_API_KEY=none
```

## Request the backend sends

`POST {MODEL_BASE_URL}/chat/completions`

```json
{
  "model": "<MODEL_NAME>",
  "temperature": 0,
  "max_tokens": 600,
  "messages": [
    {"role": "system", "content": "<model/prompt.md, verbatim, trimmed>"},
    {"role": "user", "content": "<ModelRequest as compact JSON: JSON.stringify(req)>"}
  ],
  "response_format": {"type": "json_schema", "json_schema": {"name": "ModelResponse", "schema": <model/schemas/model-response.json>}}
}
```

- **Ready responses now include `acuityReason`, before `acuity`** (see `CONTRACT_CHANGES.md`). Show it under the acuity chip; treat a reply whose `acuityReason` names a different level than `acuity` as invalid → fallback.
- **Guided decoding:** vLLM (xgrammar) rejects `uniqueItems` with a 400 error. Send the schema with every `uniqueItems` key removed; still validate the reply against the full schema.
- The system prompt must be **byte-identical** to `model/prompt.md` (trimmed). The fine-tune was trained on it, and prefix caching makes it free after the first call.
- Send the ModelRequest as compact JSON (`JSON.stringify(req)`, no indentation), with keys in the order of `model-request.json`.
- Parse `choices[0].message.content` as JSON. Then run the semantic checks from `model/README.md`: every id is from the request, each exactly once, `recommendedAmbulanceId` is among them. If any check fails, use the fallback.
- Suggested timeout: 4 s. Show the fallback immediately and replace it when the model answers (see [architecture](../docs/architecture.md) for fallback and hard-deadline behavior).

## Where it runs

Each server uses vLLM on one Empire AI Alpha H100 MIG `1g.10gb` slice. It loads the FP8 base and LoRA adapter by name. Slurm **176529** is scheduled for **Sunday, Nov 8, 09:00–15:00 EST** with guided warmup. Its node is assigned at startup.

The job was submitted from `~/nysairr/model` with these settings.

```bash
sbatch --begin=2026-11-08T09:00:00 --time=06:00:00 \
  --export=ALL,BASE_MODEL=Qwen/Qwen3-4B-Instruct-2507,PORT=32291,SERVE_RANK_CANDIDATES=1,SERVE_WARMUP=guided,SERVE_MERGED=0,SERVE_NGRAM=0 \
  cluster/serve.sbatch r3-4b
```

## Tunnel from the laptop

The laptop tunnel currently forwards port 8000 to `alphagpu02:32291`. Keep the authenticated `ssh empire` terminal open. Check that the endpoint lists `qwen3-4b-dispatch-lora`.

```bash
curl -fsS http://127.0.0.1:8000/v1/models
```

When the morning job is running, point the tunnel at its assigned node.

```bash
NODE=$(ssh empire 'squeue -h -j 176529 -t RUNNING -o %N')
if [[ -n "$NODE" ]]; then
  ssh -O cancel -L 127.0.0.1:8000:alphagpu02:32291 empire 2>/dev/null || true
  ssh -O forward -L "127.0.0.1:8000:$NODE:32291" empire
  curl -fsS http://127.0.0.1:8000/v1/models
else
  echo "Slurm job 176529 is still waiting to start."
fi
```

The morning warmup writes `~/nysairr/model/logs/warm-176529.json` on Empire. If the server is unavailable, the backend can run in `MODEL_MODE=fallback`.
