#!/bin/bash
#SBATCH -p alpha
#SBATCH -A rpicourse
#SBATCH --reservation=binghamton_hackathon
#SBATCH --gres=gpu:1g.10gb:1
#SBATCH -c 1
#SBATCH --mem=32G
#SBATCH -t 06:00:00
#SBATCH -J dispatch-train
#SBATCH -o logs/%x-%j.out
# usage: sbatch cluster/train.sbatch <run-id> [extra train.py args, e.g. --max-steps 50 | --resume]
set -euo pipefail
source cluster/common.sh
RUN=${1:?run-id}; shift
"$VENV_TRAIN/bin/python" -u training/train.py --run-id "$RUN" "$@"
