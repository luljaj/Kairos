# Sourced by every job. Paths on the cluster; override with env vars if quotas differ.
export PROJ=${PROJ:-$HOME/nysairr/model}
export HF_HOME=${HF_HOME:-$HOME/hf}
export VENV_TRAIN=${VENV_TRAIN:-$HOME/venvs/train}
export VENV_SERVE=${VENV_SERVE:-$HOME/venvs/serve}
export HF_HUB_OFFLINE=1          # weights are pre-downloaded on the login node
export TOKENIZERS_PARALLELISM=false
export OMP_NUM_THREADS=1         # 1 CPU per slice
cd "$PROJ"
nvidia-smi -L
