"""LoRA SFT for the dispatch model (TRL SFTTrainer + PEFT). Loss on assistant tokens only.

python training/train.py --run-id smoke --max-steps 50
python training/train.py --run-id r1 --epochs 2

Writes runs/<run-id>/{config.json, adapter/, train_log.json, reload_check.json}.
Default is QLoRA (base in 4-bit NF4) because a 1g.10gb slice cannot hold BF16 4B + activations.
Checkpoints every --save-steps; rerun with --resume after a 6 h job limit.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def to_pc(path: Path, template_kwargs: dict):
    """messages -> conversational prompt/completion so TRL masks the prompt."""
    from datasets import Dataset
    rows = []
    extras = {"chat_template_kwargs": template_kwargs} if template_kwargs else {}
    for line in path.open():
        r = json.loads(line)
        m = r["messages"]
        rows.append({"prompt": m[:2], "completion": m[2:], **extras})
    return Dataset.from_list(rows)


def recommendation_span(ids, key, after):
    """Find the recommended ID in a tokenized, compact ready response."""
    key_start = next((i for i, token in enumerate(ids) if token == key[0] and ids[i:i + len(key)] == key), None)
    if key_start is None:
        return None
    start = key_start + len(key)
    end = next((i for i in range(start, len(ids)) if ids[i:i + len(after)] == after), None)
    return (start, end) if end is not None else None


def recommendation_loss(tok, weight):
    import torch
    from torch.nn.functional import cross_entropy

    key = tok.encode('recommendedAmbulanceId":"', add_special_tokens=False)
    after = tok.encode('","candidates', add_special_tokens=False)

    def loss(outputs, labels, num_items_in_batch=None):
        # Trainer supplies completion-only labels and the accumulated token count.
        targets = labels[:, 1:]
        valid = targets != -100
        weights = torch.ones_like(targets, dtype=torch.float32)
        for i, ids in enumerate(targets.tolist()):
            span = recommendation_span(ids, key, after)
            if span is not None:
                start, end = span
                weights[i, start:end] = weight
        logits = outputs.logits[:, :-1][valid].float()
        losses = cross_entropy(logits, targets[valid], reduction="none")
        count = valid.sum() if num_items_in_batch is None else num_items_in_batch
        return (losses * weights[valid]).sum() / torch.as_tensor(count, device=losses.device).clamp(min=1)

    return loss


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-id", required=True)
    ap.add_argument("--base", default=os.environ.get("BASE_MODEL", "Qwen/Qwen3-4B-Instruct-2507"))
    ap.add_argument("--data", default=str(ROOT / "data/generated"))
    ap.add_argument("--epochs", type=float, default=2)
    ap.add_argument("--max-steps", type=int, default=-1)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--r", type=int, default=16)
    ap.add_argument("--alpha", type=int, default=32)
    ap.add_argument("--bs", type=int, default=1)
    ap.add_argument("--grad-accum", type=int, default=16)
    ap.add_argument("--max-len", type=int, default=2560)
    ap.add_argument("--bf16-lora", action="store_true", help="full BF16 base (only use with small models on a 10 GB slice)")
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--init-adapter", help="initialize LoRA weights from a saved adapter and start a new run")
    ap.add_argument("--recommendation-weight", type=float, default=1.0, help="loss multiplier for the recommended ambulance ID")
    ap.add_argument("--reload-only", action="store_true", help="only run the save/reload check on runs/<run-id>/adapter")
    ap.add_argument("--save-steps", type=int, default=100)
    a = ap.parse_args()
    if a.recommendation_weight < 1.0:
        ap.error("--recommendation-weight must be at least 1")

    import torch
    from huggingface_hub import try_to_load_from_cache
    from peft import LoraConfig, PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from trl import SFTConfig, SFTTrainer

    run = ROOT / "runs" / a.run_id
    run.mkdir(parents=True, exist_ok=True)
    template_kwargs = {"enable_thinking": False} if a.base == "Qwen/Qwen3-1.7B" else {}
    kw = dict(dtype=torch.bfloat16, attn_implementation="sdpa", device_map={"": 0})
    if not a.bf16_lora:  # QLoRA default: 10 GB MIG slice
        kw["quantization_config"] = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                                                       bnb_4bit_compute_dtype=torch.bfloat16,
                                                       bnb_4bit_use_double_quant=True)
    if a.reload_only:
        tok = AutoTokenizer.from_pretrained(a.base)
        return reload_check(a, kw, run, tok, to_pc(Path(a.data) / "val.jsonl", template_kwargs))
    data = Path(a.data)
    train_ds = to_pc(data / "train.jsonl", template_kwargs)
    val_ds = to_pc(data / "val.jsonl", template_kwargs)
    val_ds = val_ds.select(range(min(100, len(val_ds))))  # in-training eval is slow on 1/7 H100

    tok = AutoTokenizer.from_pretrained(a.base)
    def ntok(msgs):
        formatted = tok.apply_chat_template(msgs, tokenize=False, **template_kwargs)
        return len(tok(formatted, add_special_tokens=False)["input_ids"])
    lens = [ntok(r["prompt"] + r["completion"]) for r in train_ds.select(range(200))]
    print(f"token length sample: max={max(lens)} mean={sum(lens)/len(lens):.0f}", flush=True)

    model = AutoModelForCausalLM.from_pretrained(a.base, **kw)

    cached_config = None if Path(a.base).is_dir() else try_to_load_from_cache(a.base, "config.json")
    base_rev = Path(cached_config).parent.name if isinstance(cached_config, str) else None
    try:
        git = subprocess.check_output(["git", "-C", str(ROOT), "rev-parse", "HEAD"], text=True).strip()
    except Exception:
        git = None
    cfg = {**vars(a), "base_revision": base_rev, "git": git,
           "data_sha256": {s: sha(data / f"{s}.jsonl") for s in ("train", "val", "test")},
           "prompt_sha256": sha(ROOT / "prompt.md"), "training_script_sha256": sha(Path(__file__)),
           "token_len_sample_max": max(lens),
           "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
           "started": time.strftime("%Y-%m-%dT%H:%M:%S")}
    (run / "config.json").write_text(json.dumps(cfg, indent=2))

    peft_cfg = None
    if a.init_adapter:
        model = PeftModel.from_pretrained(model, a.init_adapter, is_trainable=True)
    else:
        peft_cfg = LoraConfig(r=a.r, lora_alpha=a.alpha, lora_dropout=0.05,
                              target_modules="all-linear", task_type="CAUSAL_LM")
    sft = SFTConfig(
        output_dir=str(run / "ckpt"), num_train_epochs=a.epochs, max_steps=a.max_steps,
        per_device_train_batch_size=a.bs, per_device_eval_batch_size=a.bs, gradient_accumulation_steps=a.grad_accum,
        learning_rate=a.lr, lr_scheduler_type="cosine", warmup_steps=10, logging_steps=5,
        eval_strategy="steps", eval_steps=100 if a.max_steps < 0 else max(10, a.max_steps // 2),
        save_strategy="steps", save_steps=a.save_steps, save_total_limit=2, bf16=True, gradient_checkpointing=True, max_length=a.max_len,
        completion_only_loss=True, report_to=[], seed=7, dataloader_num_workers=0,
    )
    loss = recommendation_loss(tok, a.recommendation_weight) if a.recommendation_weight > 1.0 else None
    trainer = SFTTrainer(model=model, args=sft, train_dataset=train_ds, eval_dataset=val_ds,
                         processing_class=tok, peft_config=peft_cfg, compute_loss_func=loss)
    t0 = time.time()
    trainer.train(resume_from_checkpoint=a.resume or None)
    dt = time.time() - t0
    trainer.model.save_pretrained(str(run / "adapter"))
    tok.save_pretrained(str(run / "adapter"))
    steps = trainer.state.global_step
    log = {"seconds": dt, "steps": steps, "sec_per_step": dt / max(1, steps),
           "max_mem_gb": torch.cuda.max_memory_allocated() / 1e9 if torch.cuda.is_available() else None,
           "log_history": trainer.state.log_history}
    (run / "train_log.json").write_text(json.dumps(log, indent=2))
    print(json.dumps({k: v for k, v in log.items() if k != "log_history"}), flush=True)

    del trainer, model
    import gc
    gc.collect()
    torch.cuda.empty_cache()
    reload_check(a, kw, run, tok, val_ds)


def reload_check(a, kw, run, tok, val_ds):
    """Fresh base + saved adapter, greedy-generate one val example."""
    import torch
    from transformers import AutoModelForCausalLM
    from peft import PeftModel
    base = AutoModelForCausalLM.from_pretrained(a.base, **kw)
    m = PeftModel.from_pretrained(base, str(run / "adapter")).eval()
    ex = val_ds[0]
    text_in = tok.apply_chat_template(ex["prompt"], add_generation_prompt=True, tokenize=False,
                                      **ex.get("chat_template_kwargs", {}))
    ids = tok(text_in, return_tensors="pt", add_special_tokens=False)["input_ids"].to(m.device)
    with torch.no_grad():
        out = m.generate(ids, max_new_tokens=400, do_sample=False)
    text = tok.decode(out[0, ids.shape[1]:], skip_special_tokens=True)
    ok = False
    try:
        ok = json.loads(text) == json.loads(ex["completion"][0]["content"]) or bool(json.loads(text))
    except Exception:
        pass
    (run / "reload_check.json").write_text(json.dumps({"parsed_json": ok, "output": text,
                                                       "expected": ex["completion"][0]["content"]}, indent=2))
    print("reload check:", ok, text[:300], flush=True)


if __name__ == "__main__":
    sys.exit(main())
