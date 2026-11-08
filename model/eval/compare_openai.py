"""Compare an OpenAI model with saved r1 Qwen on identical held-out cases.

Run from the repository: model/.venv/bin/python -I model/eval/compare_openai.py
Bounded parallel, resumable requests; API credentials are never written to artifacts.
"""
from __future__ import annotations

import argparse
from collections import deque
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parent))
from evaluate import ROOT, SYSTEM, RES_SCHEMA, aggregate, score, strip_keys

MODEL_CONFIG = {
    "gpt-5.4-mini": ("gpt54mini", "GPT-5.4-mini", (.75, .075, 4.5)),
    "gpt-5.4": ("gpt54", "GPT-5.4", (2.5, .25, 15.0)),
    "gpt-6-luna": ("gpt6luna", "GPT-6 Luna", (.1, .01, .5)),
}


def digest(value):
    return hashlib.sha256(value).hexdigest()


def credential(env_file):
    key = os.environ.get("OPENAI_API_KEY") or os.environ.get("MODEL_API_KEY")
    if not key and env_file.exists():
        values = {}
        for line in env_file.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                values[k.strip()] = v.strip().strip("\"'")
        key = values.get("OPENAI_API_KEY") or values.get("MODEL_API_KEY")
    if not key or key == "none":
        raise SystemExit("Configure OPENAI_API_KEY or MODEL_API_KEY before running.")
    return key


def response_schema():
    # OpenAI requires an object at the root. Only the transport envelope differs.
    schema = strip_keys(RES_SCHEMA)
    def explicit_types(node):
        if isinstance(node, dict):
            if "const" in node:
                node["enum"] = [node.pop("const")]
            if "enum" in node and "type" not in node:
                node["type"] = "string"
            for value in node.values():
                explicit_types(value)
        elif isinstance(node, list):
            for value in node:
                explicit_types(value)
    explicit_types(schema)
    return {"type": "object", "additionalProperties": False,
            "required": ["result"], "properties": {"result": {"anyOf": schema["anyOf"]}},
            "$defs": schema["$defs"]}


def request_one(req, key, model):
    body = {"model": model, "reasoning_effort": "none", "max_completion_tokens": 600,
            "messages": [{"role": "system", "content": SYSTEM +
                          '\n\nPut the complete response object inside the top-level "result" key.'},
                         {"role": "user", "content": json.dumps(req, separators=(",", ":"))}],
            "response_format": {"type": "json_schema", "json_schema": {
                "name": "ModelResponse", "strict": True, "schema": response_schema()}}}
    request = urllib.request.Request("https://api.openai.com/v1/chat/completions",
                                     data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"})
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.load(response)
    except urllib.error.HTTPError as exc:
        # Do not dump headers or credentials. Stop instead of scoring an API outage as model errors.
        detail = json.loads(exc.read()).get("error", {})
        raise RuntimeError(f"API HTTP {exc.code}: {detail.get('code')} {detail.get('message')}") from None
    elapsed = (time.perf_counter() - started) * 1000
    choice = data["choices"][0]
    text = choice["message"].get("content") or ""
    try:
        output = json.dumps(json.loads(text)["result"])
    except (ValueError, KeyError, TypeError):
        output = text
    return output, elapsed, {"usage": data.get("usage", {}), "resolved_model": data["model"],
                             "finish_reason": choice["finish_reason"],
                             "refusal": choice["message"].get("refusal")}


def ordered_parallel(fn, items, concurrency):
    """Keep at most concurrency requests in flight and yield in input order.

    Ordered checkpoints remain a resumable prefix. On failure, cancel queued
    work instead of submitting the rest of the benchmark.
    """
    pending = deque()
    source = iter(items)
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        try:
            for _ in range(concurrency):
                item = next(source, None)
                if item is None:
                    break
                pending.append(executor.submit(fn, item))
            while pending:
                yield pending.popleft().result()
                item = next(source, None)
                if item is not None:
                    pending.append(executor.submit(fn, item))
        finally:
            for future in pending:
                future.cancel()


def write_report(out, results):
    model = results[0][2]["meta"]["model"]
    _, display_name, rates = MODEL_CONFIG[model]
    lines = [f"# {display_name} vs fine-tuned Qwen 4B", "",
             "Labels come from a synthetic demo rubric. These results measure agreement with that rubric, not clinical correctness.", "",
             "Identical held-out requests, full rubric prompt and scorer. OpenAI uses a required result envelope, strict schema decoding, reasoning=none and a 600-token output cap. Qwen uses vLLM guided decoding and a 600-token cap. No prompt tuning on these sets.", "",
             "| Split | Model | N | Schema | Acuity | Recommendation | p50 ms | p95 ms |",
             "|---|---|---:|---:|---:|---:|---:|---:|"]
    paired = []
    for split, baseline, current in results:
        for name, result in [("Qwen 4B fine-tuned r1", baseline), (display_name, current)]:
            m = result["metrics"]
            lines.append(f"| {split} | {name} | {m['n']} | {m['schema_valid']:.1%} | {m['acuity_exact']:.1%} | {m['rec_match']:.1%} | {m['latency_p50_ms']} | {m['latency_p95_ms']} |")
        pairs = list(zip(baseline["rows"], current["rows"]))
        wins = sum(not b["acuity_exact"] and c["acuity_exact"] for b, c in pairs)
        losses = sum(b["acuity_exact"] and not c["acuity_exact"] for b, c in pairs)
        paired.append(f"{split}: GPT correct / Qwen wrong on {wins} cases; Qwen correct / GPT wrong on {losses} cases.")
    lines += ["", *paired, ""]
    lines += ["| Split | Model | Needs-info precision | Needs-info recall | Suitability | Experience-exception recommendation |",
              "|---|---|---:|---:|---:|---:|"]
    def pct(value):
        return "—" if value is None else f"{value:.1%}"
    for split, baseline, current in results:
        for name, result in [("Qwen 4B", baseline), (display_name, current)]:
            m = result["metrics"]
            lines.append(f"| {split} | {name} | " + " | ".join(pct(m[k]) for k in
                         ("nmi_precision", "nmi_recall", "suit_acc", "exception_rec_match")) + " |")
    lines += [""]
    usage = [r["usage"] for _, _, current in results for r in current["rows"]]
    inp = sum(u.get("prompt_tokens", 0) for u in usage)
    cached = sum(u.get("prompt_tokens_details", {}).get("cached_tokens", 0) for u in usage)
    output = sum(u.get("completion_tokens", 0) for u in usage)
    cost = ((inp - cached) * rates[0] + cached * rates[1] + output * rates[2]) / 1e6
    writes = sum(u.get("prompt_tokens_details", {}).get("cache_write_tokens", 0) for u in usage)
    if model == "gpt-6-luna":
        cost += writes * .025 / 1e6  # $0.125 write rate replaces the $0.10 input rate.
    lines += [f"OpenAI usage: {inp:,} input tokens ({cached:,} cached), {output:,} output tokens; estimated cost ${cost:.4f} at published standard rates.", "",
              f"Cache-write tokens: {writes:,}; Luna cache-write premium included when applicable.", "",
              f"Latency is per-request wall time at OpenAI concurrency {results[0][2]['meta']['concurrency']}: OpenAI over the internet versus saved Qwen runs through the laptop SSH tunnel to one H100 MIG slice. Concurrent and sequential latencies are not directly comparable. Different hosting hardware; no retries included. First request is included.", "",
              "The synthetic bank was filtered with base Qwen. The paraphrase split deliberately contains keyword-rule disagreements; demo cases are curated. These sets are not an independent real-world benchmark.", "",
              f"OpenAI model reference: https://developers.openai.com/api/docs/models/{model}", ""]
    (out / "comparison.md").write_text("\n".join(lines))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", choices=MODEL_CONFIG, default="gpt-5.4-mini")
    parser.add_argument("--env-file", type=Path, default=ROOT.parent / "web/.env.local")
    parser.add_argument("--out", type=Path)
    parser.add_argument("--baseline", type=Path, default=ROOT / "runs/r1")
    parser.add_argument("--limit", type=int, default=0, help="Smoke test only; use a separate output directory")
    parser.add_argument("--concurrency", type=int, default=4,
                        help="parallel requests (default: 4); use 1 for sequential latency comparisons")
    args = parser.parse_args()
    if args.concurrency < 1:
        parser.error("--concurrency must be at least 1")
    slug = MODEL_CONFIG[args.model][0]
    args.out = args.out or ROOT / (f"runs/{slug}-vs-r1" +
                                  (f"-c{args.concurrency}" if args.concurrency != 1 else ""))
    key = credential(args.env_file)
    args.out.mkdir(parents=True, exist_ok=True)
    results = []
    for split, path in [("demo", ROOT / "fixtures/demo/demo.jsonl"),
                        ("test", ROOT / "data/generated/test.jsonl"),
                        ("paraphrase", ROOT / "data/generated/paraphrase.jsonl")]:
        items = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
        baseline = json.loads((args.baseline / f"eval-ft-{split}.json").read_text())
        if args.limit:
            items = items[:args.limit]
            baseline["rows"] = baseline["rows"][:args.limit]
            baseline["metrics"] = aggregate(baseline["rows"])
        if [i["meta"]["request"]["requestId"] for i in items] != [r["id"] for r in baseline["rows"]]:
            raise SystemExit(f"Baseline IDs/order do not match {split}")
        if baseline["meta"].get("short_prompt"):
            raise SystemExit("Baseline must use the full rubric prompt")
        meta = {"model": args.model, "split": split, "data_sha256": digest(path.read_bytes()),
                "prompt_sha256": digest(SYSTEM.encode()), "schema_sha256": digest(json.dumps(response_schema()).encode()),
                "baseline_sha256": digest((args.baseline / f"eval-ft-{split}.json").read_bytes()),
                "reasoning_effort": "none", "max_completion_tokens": 600, "limit": args.limit,
                "concurrency": args.concurrency, "system": "http", "guided": True}
        manifest = args.out / f"manifest-{split}.json"
        if manifest.exists() and json.loads(manifest.read_text()) != meta:
            raise SystemExit("Run configuration changed; choose a fresh --out directory")
        manifest.write_text(json.dumps(meta, indent=2))
        checkpoint = args.out / f"rows-{split}.jsonl"
        rows = [json.loads(line) for line in checkpoint.read_text().splitlines()] if checkpoint.exists() else []
        if [r["id"] for r in rows] != [i["meta"]["request"]["requestId"] for i in items[:len(rows)]]:
            raise SystemExit("Checkpoint IDs do not match input")
        def run(item):
            req, label = item["meta"]["request"], item["meta"]["label"]
            output, ms, extra = request_one(req, key, args.model)
            row = score(req, label, output)
            row.update(id=req["requestId"], gold_status=label["status"], gold_acuity=label.get("acuity"),
                       family=item["meta"].get("family"), latency_ms=ms, output=output, error=None, **extra)
            return row

        for row in ordered_parallel(run, items[len(rows):], args.concurrency):
            with checkpoint.open("a") as handle:
                handle.write(json.dumps(row) + "\n")
            rows.append(row)
            if len(rows) % 10 == 0 or len(rows) == len(items):
                print(f"{split}: {len(rows)}/{len(items)}; acuity={aggregate(rows)['acuity_exact']:.1%}", flush=True)
        metrics = aggregate(rows)
        if args.concurrency > 1:
            metrics["latency_note"] = f"measured at concurrency {args.concurrency}"
        result = {"meta": meta, "metrics": metrics, "rows": rows}
        (args.out / f"eval-{slug}-{split}.json").write_text(json.dumps(result, indent=1))
        results.append((split, baseline, result))
        write_report(args.out, results)
    print(args.out / "comparison.md", flush=True)


if __name__ == "__main__":
    main()
