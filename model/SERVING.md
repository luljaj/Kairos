# Serving — how the backend reaches the model

Status: **base model serving being brought up; fine-tuned adapter not yet trained.** Update this file when that changes.

## Backend env vars

```bash
MODEL_MODE=model                      # or fallback / mock
MODEL_BASE_URL=http://localhost:8000/v1
MODEL_NAME=Qwen/Qwen3-4B-Instruct-2507        # base (until the adapter passes the gate)
# MODEL_NAME=qwen3-4b-dispatch-lora           # fine-tuned, same server
MODEL_API_KEY=none                     # only checked if the job was started with MODEL_API_KEY set
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
- Suggested timeout: 4 s. Show the fallback immediately and replace it when the model answers (a 1/7 H100 slice is slow; see `plan/05`).

## Where it runs

Empire AI Alpha, one MIG `1g.10gb` slice: vLLM, base model in FP8, LoRA adapter loaded by name. Job: `sbatch cluster/serve.sbatch [run-id]` (from `~/nysairr/model` on the cluster). Max 6 h per job, so **resubmit Sunday ~09:00** so it covers judging.

## Tunnel from the laptop

Needs the shared SSH connection open (`ssh empire` in a terminal, with password + authenticator code; `~/.ssh/config` has ControlMaster for host `empire`).

```bash
NODE=$(ssh empire cat nysairr/model/logs/serve-node.txt)
ssh -N -L 8000:$NODE:8000 empire
```

Check:

```bash
curl -s localhost:8000/v1/models
```
