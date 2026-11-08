# Qwen-4b-Dispatch training

## Stack and configuration

Base: `Qwen/Qwen3-4B-Instruct-2507`. Training runs on Empire AI Alpha under Slurm, using an H100 MIG `1g.10gb` allocation.

| Setting | Configuration |
|---|---|
| Libraries | PyTorch, Transformers, TRL SFTTrainer, PEFT, bitsandbytes, datasets |
| Base quantization | 4-bit NF4 with double quantization |
| Compute | BF16; scaled dot-product attention |
| Adapters | LoRA rank 16, alpha 32, dropout 0.05, all linear modules |
| Batch | Per-device batch 1, gradient accumulation 16 |
| Memory | Gradient checkpointing; maximum sequence length 2,560 |
| Objective | Assistant-completion-only supervised fine-tuning |
| Initial run | Two epochs; learning rate 2e-4; cosine schedule |
| Selected follow-up | r3-4b, initialized from r1; 1.5 epochs; learning rate 1e-4 |

The archived [r3 configuration](../model/benchmarks/2026-11-08-r3-comparison/r3-config.json) records model revision and hashes for data, prompt, adapter, and code. The training script saves checkpoints, logs, and a fresh-base adapter reload check. That reload check verifies parseable JSON; the evaluation harness performs the fuller correctness checks.

## Data

The initial split contains 3,000 training, 300 validation, and 300 test scenarios, with 150 paraphrase challenges and 40 separate demo cases. Targets are generated from scenario concepts and the prototype rubric, then checked for schema validity, label consistency, numerical grounding, and concise reasons. A base-model second pass checks complaint meaning; it is not an independent clinical verifier and has limitations on negation.

Thirty percent of training rows use a short system instruction instead of the full rubric. Main comparisons retain the full rubric; short-prompt evaluations are separate. In-training validation samples at most 100 validation rows for cost reasons.

The selected r3 follow-up uses 3,940 training examples, adding verified plain-language contrasts and 300 matched fleet pairs. Follow-up preparation copies the original validation and test files unchanged. Demo and paraphrase cases are not training rows, but evaluation feedback influenced development, so these sets are not an untouched final generalization test.

## Experiments and selection

- **r1:** initial 4B adapter; 88.3% main-test acuity.
- **r3-4b:** targeted follow-up; 91.7% main-test acuity and 94.3% raw recommendation accuracy. Selected adapter.
- **r5-4b:** 4,520 training examples, 600 fleet pairs, randomized request IDs, and increased loss weight on ambulance-ID tokens. Completed with 90.7% main-test acuity and 93.2% raw recommendation accuracy. Did not replace r3.

An additional 1.7B experiment explored latency, but the selected model is the 4B adapter. Detailed historical records remain in [STATUS.md](../model/STATUS.md).

## Training and serving entry points

From `model/`, `cluster/setup_login.sh` creates separate training and serving environments and downloads weights on the cluster login node. Review account, reservation, and filesystem settings in `cluster/common.sh` and the Slurm scripts for your allocation.

```bash
sbatch cluster/train.sbatch r1 --epochs 2
sbatch cluster/train.sbatch r3-4b --data runs/r3-4b/data --init-adapter runs/r1/adapter --epochs 1.5 --lr 1e-4
```

These commands require prepared data and cluster access; generated data and adapter weights are not bundled in the repository. See `data/generate.py`, `data/verify.py`, and `data/prepare_followup.py` for preparation arguments. Do not overwrite a recorded run when reproducing an experiment; choose a new run ID.

Serving uses vLLM with FP8 base weights and the adapter, structured JSON decoding, prefix caching, and up to four concurrent sequences. See [SERVING.md](../model/SERVING.md) for cluster configuration and [architecture](architecture.md) for the guardrail middleware.
