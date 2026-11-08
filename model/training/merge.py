"""Merge a trained LoRA into its BF16 base before vLLM FP8 quantization."""
from __future__ import annotations

import argparse
import tempfile
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    ap.add_argument("--adapter", required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer

    base = AutoModelForCausalLM.from_pretrained(args.base, dtype=torch.bfloat16, device_map={"": 0})
    with torch.no_grad():
        merged = PeftModel.from_pretrained(base, args.adapter).merge_and_unload(safe_merge=True)
    tok = AutoTokenizer.from_pretrained(args.adapter)
    # Publish a complete checkpoint so an interrupted merge can be retried safely.
    with tempfile.TemporaryDirectory(dir=args.out.parent) as tmp:
        staged = Path(tmp) / "model"
        merged.save_pretrained(staged)
        tok.save_pretrained(staged)
        staged.rename(args.out)


if __name__ == "__main__":
    main()
