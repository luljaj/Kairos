#!/bin/bash
#SBATCH -p alpha
#SBATCH -A rpicourse
#SBATCH --reservation=binghamton_hackathon
#SBATCH --gres=gpu:1g.10gb:1
#SBATCH -c 1
#SBATCH --mem=32G
#SBATCH -t 01:00:00
#SBATCH -J dispatch-eval-client
#SBATCH -o logs/%x-%j.out
# Not normally needed: evaluate.py is a plain HTTP client and runs on the login node against the
# serving job (CPU-only jobs are rejected, so this wrapper exists only if the login node can't reach it).
set -euo pipefail
source cluster/common.sh
"$VENV_TRAIN/bin/python" -I eval/evaluate.py "$@"
