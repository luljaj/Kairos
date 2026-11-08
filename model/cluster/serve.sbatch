#!/bin/bash
#SBATCH -p alpha
#SBATCH -A rpicourse
#SBATCH --reservation=binghamton_hackathon
#SBATCH --gres=gpu:1g.10gb:1
#SBATCH -c 1
#SBATCH --mem=32G
#SBATCH -t 06:00:00
#SBATCH -J dispatch-serve
#SBATCH -o logs/%x-%j.out
# usage: sbatch cluster/serve.sbatch [run-id-with-adapter]   (no arg = base model only)
set -euo pipefail
source cluster/common.sh
BASE=${BASE_MODEL:-Qwen/Qwen3-4B-Instruct-2507}
PORT=${PORT:-8000}
LOAD="$BASE"
SERVED_BASE="$BASE"
ADAPTER_NAME=qwen3-4b-dispatch-lora
CHAT_TEMPLATE=()
if [[ "$BASE" == Qwen/Qwen3-1.7B ]]; then
  ADAPTER_NAME=qwen3-1.7b-dispatch-lora
  CHAT_TEMPLATE=(--default-chat-template-kwargs '{"enable_thinking":false}')
fi
LORA=()
SERVED="$BASE"
if [ -n "${1:-}" ]; then
  ADAPTER="$PROJ/runs/$1/adapter"
  SERVED="$ADAPTER_NAME"
  if [[ "${SERVE_MERGED:-0}" == 1 ]]; then
    DIGEST=$(sha256sum "$ADAPTER/adapter_model.safetensors" | cut -c1-16)
    LOAD="$PROJ/runs/$1/merged-$DIGEST"
    if [[ ! -f "$LOAD/config.json" ]]; then
      "$VENV_TRAIN/bin/python" -I training/merge.py --base "$BASE" --adapter "$ADAPTER" --out "$LOAD"
    fi
    SERVED_BASE="$ADAPTER_NAME"
  else
    LORA=(--enable-lora --max-lora-rank 16 --max-loras 1 --lora-modules "$ADAPTER_NAME=$ADAPTER")
  fi
fi
echo "SERVING on $(hostname):$PORT  base=$BASE adapter=${1:-none} merged=${SERVE_MERGED:-0}"
if [[ "$PORT" == 8000 ]]; then
  hostname > "$PROJ/logs/serve-node.txt"
fi
API_KEY_ARGS=()
[ -n "${MODEL_API_KEY:-}" ] && API_KEY_ARGS=(--api-key "$MODEL_API_KEY")
SPEC=()
if [[ "${SERVE_NGRAM:-0}" == 1 ]]; then
  SPEC=(--speculative-config '{"method":"ngram","num_speculative_tokens":5,"prompt_lookup_min":2,"prompt_lookup_max":4}')
fi
if [[ -n "${SERVE_WARMUP:-}" ]]; then
  WARMUP_ARGS=()
  [[ "$SERVE_WARMUP" == guided ]] && WARMUP_ARGS+=(--guided)
  (
    for ((attempt = 0; attempt < 120; attempt++)); do
      if curl -fsS --max-time 2 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
        "$VENV_TRAIN/bin/python" -I eval/evaluate.py --system http --base-url "http://127.0.0.1:$PORT/v1" \
          --model "$SERVED" --data fixtures/demo/demo.jsonl --limit 1 \
          --out "logs/warm-$SLURM_JOB_ID.json" "${WARMUP_ARGS[@]}"
        exit
      fi
      sleep 5
    done
    echo "Warmup timed out waiting for vLLM" >&2
  ) &
fi
exec "$VENV_SERVE/bin/vllm" serve "$LOAD" --served-model-name "$SERVED_BASE" \
  --host 0.0.0.0 --port "$PORT" \
  --quantization fp8 --dtype bfloat16 \
  --max-model-len 4096 --max-num-seqs 4 --gpu-memory-utilization 0.90 \
  --enable-prefix-caching "${CHAT_TEMPLATE[@]}" "${LORA[@]}" "${SPEC[@]}" "${API_KEY_ARGS[@]}"
