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
LORA=()
if [ -n "${1:-}" ]; then
  LORA=(--enable-lora --max-lora-rank 16 --max-loras 1 --lora-modules "qwen3-4b-dispatch-lora=$PROJ/runs/$1/adapter")
fi
echo "SERVING on $(hostname):$PORT  base=$BASE adapter=${1:-none}"
echo "$(hostname)" > "$PROJ/logs/serve-node.txt"
API_KEY_ARGS=()
[ -n "${MODEL_API_KEY:-}" ] && API_KEY_ARGS=(--api-key "$MODEL_API_KEY")
exec "$VENV_SERVE/bin/vllm" serve "$BASE" --served-model-name "$BASE" \
  --host 0.0.0.0 --port "$PORT" \
  --quantization fp8 --dtype bfloat16 \
  --max-model-len 4096 --max-num-seqs 4 --gpu-memory-utilization 0.90 \
  --enable-prefix-caching "${LORA[@]}" "${API_KEY_ARGS[@]}"
