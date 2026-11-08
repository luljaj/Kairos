#!/bin/bash
# Run ONCE on the login node (has internet, no GPU): envs + weights. Jobs then run offline.
set -euo pipefail
source "$(dirname "$0")/common.sh" 2>/dev/null || true
export HF_HUB_OFFLINE=0
command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH=$HOME/.local/bin:$PATH
uv venv -q --python 3.12 "$VENV_TRAIN"
uv pip install -q --python "$VENV_TRAIN/bin/python" torch transformers trl peft bitsandbytes datasets accelerate jsonschema
uv venv -q --python 3.12 "$VENV_SERVE"
uv pip install -q --python "$VENV_SERVE/bin/python" vllm jsonschema
"$VENV_TRAIN/bin/hf" download Qwen/Qwen3-4B-Instruct-2507 --exclude "*.pth" >/dev/null
"$VENV_TRAIN/bin/hf" download Qwen/Qwen3-1.7B --exclude "*.pth" >/dev/null || true
"$VENV_TRAIN/bin/python" -c "import torch,transformers,trl,peft;print('train env', torch.__version__, transformers.__version__, trl.__version__, peft.__version__)"
"$VENV_SERVE/bin/python" -c "import vllm;print('serve env vllm', vllm.__version__)"
du -sh "$HF_HOME"
