# 05 — Fine-tuned model (brief for the training agent)

This brief is self-contained. You own everything under `model/`. You do not touch `web/` except to read `web/lib/contracts/` and `web/fixtures/`. Deadline: a served adapter that passes the gate below by **hour 18 of the hackathon** (≈ Nov 8, 07:00; projects are due on DevPost at 11:00 and judging is 11:30–14:30). If you can't make it, the demo runs on prompted base Qwen — that's fine; report honestly.

## The task the model does

Given an incident and 1–3 ambulance candidates (the fleet is always 3 ambulances; out-of-service or incomplete-crew units are not sent) whose arrival times were already computed by the backend, return JSON with:

- `acuity`: Alpha | Bravo | Charlie | Delta | Echo (demo rubric below), or `needs_more_info`,
- `summary`: one short sentence grounded only in supplied facts,
- per candidate: `crewSuitable` (bool) and a ≤ 20-word `reason` grounded in supplied facts,
- `recommendedAmbulanceId`.

It does **not** compute ETAs, invent locations, or see names/transcripts. Exact request/response schemas: `model/schemas/model-request.json` and `model-response.json` (hand-written and canonical until `web/lib/contracts` exists, which will be made to match; examples in `model/schemas/examples/`; see also [01-contracts.md](01-contracts.md#model-request-backend--model)).

## Demo acuity rubric (simplified, not clinical)

Apply the first matching row.

| Acuity | Rule |
|---|---|
| Echo | `breathingNormally == false` and `conscious == false`; or complaint indicates not breathing, choking with no air, cardiac arrest |
| Delta | `conscious == false`; or severe breathing difficulty; or `severeBleeding == true`; or chest pain with age ≥ 35 plus another symptom; or major trauma mechanism (high-speed crash, fall > 2 storeys) |
| Charlie | chest pain otherwise; altered mental status; diabetic problem; seizure now stopped; moderate breathing difficulty; overdose with patient conscious |
| Bravo | fall or injury with possible fracture; moderate bleeding controlled; assault with injury, conscious |
| Alpha | minor injury, minor illness, conscious and breathing normally, no red flags |
| needs_more_info | `conscious` and `breathingNormally` both unknown and complaint doesn't settle it |

Required care level: Echo/Delta/Charlie → ALS; Bravo/Alpha → BLS.

## Suitability and recommendation rules

- `crewSuitable = false` if candidate `careLevel` is below the required level. Otherwise true.
- Recommend the fastest suitable candidate (`arrivalInSeconds`).
- Exception the model should learn: if the fastest suitable unit is only ≤ 60 s faster than another suitable unit, and the other has a markedly more experienced crew chief (≥ 24 months more service) for Echo/Delta, recommend the experienced one and say so. This is the only "judgement" beyond rules, it's illustrative, and it gives the fine-tune something to learn that the fallback doesn't do.
- If no candidate is suitable, recommend the fastest overall and say "No ALS unit available; fastest BLS unit."
- Reasons cite only supplied facts: care level, arrival minutes, wait from queued work, crew chief experience.

The backend's deterministic fallback implements the same rubric without the experience exception. Keep the rubric in one file (`model/rubric.py`) so labels are reproducible.

## Data

1. **Scenario generator** (`model/data/generate.py`): sample incidents (facts with realistic nulls), a fleet of exactly 3 ambulances, of which 1–3 are selectable candidates, with random care levels, crew experience, availability and travel times. Randomise candidate order and IDs.
2. **Labels**: computed by `rubric.py` (acuity, suitability, recommendation). Deterministic.
3. **Text**: chief complaints, summaries and reasons. Use a stronger LLM to write varied chief-complaint phrasing and fluent summaries/reasons, then verify each output with code: acuity and recommendation must match the rubric labels, reasons may only mention numbers present in the input. Drop failures.
4. Sizes: ~3,000 train, 300 validation, 300 held-out test. Split by **scenario family** (complaint template) so paraphrases don't leak into test.
5. Also create 30 hand-checked scenarios mirroring the demo fixtures in `web/fixtures/scenarios/` as a separate "demo" eval set. Do not train on them.

## Compute: Empire AI Alpha, hackathon reservation (fixed constraints)

Source: Empire AI "Binghamton Hackathon" KB article (Nov 6). Plan around these; they drive every choice below.

| Constraint | Value | Consequence |
|---|---|---|
| GPU | MIG `1g.10gb` slice = 1/7 of an H100 80GB: **10 GB VRAM**, ~1/7 compute and memory bandwidth | BF16 Qwen3-4B (~8 GB weights) does not fit for training and barely fits for serving |
| Slices | max **2 per person**, running at once; slices can't be combined, one program uses one slice | Use them as two separate jobs: one serving, one training/eval (or two training runs side by side) |
| Job length | max **6 h** (`-t` required); shorter jobs start sooner | Training must checkpoint and resume; serving must be resubmitted to cover the demo window |
| CPU / RAM | 1 CPU, 32 GB RAM per slice | `dataloader_num_workers=0`; install packages and download weights on the login node, not in jobs |
| Required flags | `-A rpicourse -p alpha --reservation=binghamton_hackathon --gres=gpu:1g.10gb:1` (never `gpu:1`); `-A rpicourse` is required for student027 (the account is not picked up automatically) | Every sbatch/srun in `model/` uses exactly these |
| Pool | 112 slices shared by all participants; pending reason `Resources` = all busy | Submit early; exit interactive `srun` shells immediately; don't hold idle slices |
| Window | reservation Nov 6 → Nov 9 | Covers the Sunday 11:30–14:30 judging expo |
| Access | SSH to `alpha1.empireai.edu` with password + 2FA | One multiplexed SSH connection (ControlMaster) from the laptop carries the agent's commands and the demo port forward |

## Training

- Base: `Qwen/Qwen3-4B-Instruct-2507`. **QLoRA** (base in 4-bit NF4, BF16 compute; LoRA r=16, alpha=32, all linear layers), 2 epochs, lr 2e-4, max length 2,560 tokens (prompt ~1.1–1.9k tokens, response ~125). Loss on assistant tokens only. BF16 LoRA is not possible in 10 GB.
- Batch 1–2 with gradient accumulation to an effective 16, gradient checkpointing on, `save_steps` every ~100 steps so a 6 h job limit or pre-emption loses at most minutes; resume with `--resume`.
- Library: TRL `SFTTrainer` + PEFT + bitsandbytes (prompt/completion format so only the completion is trained).
- Hardware: one `1g.10gb` slice. First a 50-step smoke test via `sbatch`: record peak memory, sec/step, projected full-run time, then save → reload the adapter → generate one example. If the projected 2-epoch run exceeds ~5 h, cut to 1 epoch or trim the data before cutting quality elsewhere.
- **Second slice in parallel:** while the 4B run trains, the other slice serves base Qwen for the base-model eval and for backend integration. If 4B misses the latency gate (see Serving), train `Qwen/Qwen3-1.7B` (non-thinking mode) on the same data as the speed fallback.
- Version together in `model/runs/<run-id>/`: data hash, config, base model revision, adapter, eval results.

## Serving

- vLLM OpenAI-compatible server in a batch job on one slice, base model plus the LoRA adapter by name (`--enable-lora --lora-modules qwen3-4b-dispatch-lora=<path>`), so `model` = adapter name or base name selects the system.
- Fitting 10 GB: load the base with **FP8 weight quantisation** (`--quantization fp8`, native on H100, ~4.5 GB for 4B) to leave room for LoRA weights and KV cache; `--max-model-len 4096`, `--max-num-seqs 4`, `--max-lora-rank 16`, `--enable-prefix-caching` (the system prompt is identical on every call). Base and fine-tuned evals run on this same FP8 serving path, so the comparison is fair and the measured latency is the demo latency.
- Latency risk: a 1/7 slice has ~1/7 of H100 memory bandwidth, so expect roughly 50–90 output tokens/s for 4B FP8; a ~200-token response is 2–4 s. Keep responses short (compact JSON, ≤ 20-word reasons), measure p95 in the smoke test, and if it misses 2 s switch to the 1.7B fallback. The backend should show the deterministic fallback immediately and replace it when the model answers (the `source` tag tells the dispatcher which).
- Reaching it from the demo laptop: the compute node isn't public. Forward through the login node over the existing multiplexed SSH connection: `ssh -N -L 8000:<compute-node>:8000 empire` → `MODEL_BASE_URL=http://localhost:8000/v1`. Document the exact command and node lookup (`squeue --me`) in `model/SERVING.md`.
- **Demo-day coverage:** the 6 h limit means a serving job started Saturday night ends before judging. Submit a fresh serving job Sunday ~09:00 (`-t 06:00:00`, or `--begin` the night before) so it runs through 15:00, warm it with one request, and re-open the tunnel. Keep `MODEL_MODE=fallback` ready if the slice pool is full.
- Same system prompt for base and fine-tuned (`model/prompt.md`), so the comparison is fair.

## Evaluation

Report on the held-out test set and the demo set, for (a) base Qwen prompted, (b) fine-tuned, (c) the deterministic fallback:

- schema-valid rate, candidate coverage,
- acuity exact match and within-one-level,
- `needs_more_info` precision/recall,
- recommendation match, suitability accuracy,
- reasons: share whose numbers all appear in the input,
- p50/p95 latency on the actual serving path.

**Gate to use in the demo:** schema-valid ≥ 99 %, recommendation match ≥ 95 %, acuity exact ≥ 90 %, p95 latency ≤ 2 s on the demo network (FP8 on a `1g.10gb` slice through the SSH forward; see Serving for the latency risk). Results are against a synthetic rubric, which says the model learned the rubric, not that it's clinically right. Write that sentence in the results file.

## Deliverables

- `model/SERVING.md` with the endpoint and model name for the backend's env vars.
- `model/runs/<run-id>/eval.md` with the comparison table.
- A one-paragraph status at hour 6, 12 and 18: what works, what's blocked.
