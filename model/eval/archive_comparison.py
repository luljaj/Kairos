"""Archive the completed four-model comparison without making API calls."""
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
PREVIOUS = ROOT / "benchmarks/2026-11-07-qwen4b-vs-gpt54mini"
OUT = ROOT / "benchmarks/2026-11-08-luna-comparison"
SPLITS = ("test", "paraphrase", "demo")
NAMES = {"qwen_base": "Qwen 4B base", "qwen_finetuned_r1": "Qwen 4B fine-tuned r1",
         "gpt54mini": "GPT-5.4-mini", "gpt6luna": "GPT-6 Luna"}
RATES = {"gpt54mini": (.75, .075, 4.5), "gpt6luna": (.1, .01, .5)}


def main():
    results, per_case, costs, disagreements = {}, [], {}, []
    # Check completeness before writing the archive.
    for split in SPLITS:
        results[split] = {}
        for name in NAMES:
            path = (ROOT / f"runs/gpt6luna-vs-r1/eval-gpt6luna-{split}.json" if name == "gpt6luna"
                    else PREVIOUS / f"results/{name}-{split}.json")
            result = json.loads(path.read_text())
            assert result["metrics"]["n"] == {"test": 300, "paraphrase": 150, "demo": 40}[split]
            results[split][name] = result
        ids = [[r["id"] for r in result["rows"]] for result in results[split].values()]
        assert all(row_ids == ids[0] for row_ids in ids)
        for key in ("prompt_sha256", "data_sha256", "schema_sha256"):
            assert results[split]["gpt6luna"]["meta"][key] == results[split]["gpt54mini"]["meta"][key]
        for rows in zip(*(results[split][name]["rows"] for name in NAMES)):
            if (len({r["acuity_exact"] for r in rows}) > 1
                    or len({r["rec_match"] for r in rows}) > 1):
                disagreements.append({"split": split, "id": rows[0]["id"],
                                      "models": dict(zip(NAMES, rows))})
    (OUT / "results").mkdir(parents=True, exist_ok=True)
    shutil.copytree(PREVIOUS / "inputs", OUT / "inputs", dirs_exist_ok=True)
    shutil.copyfile(ROOT / "eval/compare_openai.py", OUT / "inputs/compare_openai.py")
    for split, systems in results.items():
        for name, result in systems.items():
            (OUT / f"results/{name}-{split}.json").write_text(json.dumps(result, indent=1) + "\n")
            if name not in RATES:
                continue
            rate = RATES[name]
            values, uncached_values = [], []
            for row in result["rows"]:
                usage = row["usage"]
                cached = usage.get("prompt_tokens_details", {}).get("cached_tokens", 0)
                cost = ((usage["prompt_tokens"] - cached) * rate[0] + cached * rate[1]
                        + usage["completion_tokens"] * rate[2]) / 1e6
                if name == "gpt6luna":
                    cost += usage.get("prompt_tokens_details", {}).get("cache_write_tokens", 0) * .025 / 1e6
                values.append(cost)
                uncached_values.append((usage["prompt_tokens"] * rate[0] + usage["completion_tokens"] * rate[2]) / 1e6)
                per_case.append({"model": name, "split": split, "id": row["id"], "usage": usage, "usd": cost})
            costs.setdefault(name, {})[split] = {"total_usd": sum(values),
                                                 "mean_usd": sum(values) / len(values),
                                                 "uncached_input_reference_usd": sum(uncached_values)}
    lines = ["# Four-model benchmark comparison", "",
             "Saved November 8, 2026 (America/New_York). Luna run began November 7; earlier baselines were measured November 7. Qwen baseline is the completed r1 run, not later training runs.", "",
             "Test (300) is the main held-out mix of scenarios. Demo (40) is a curated presentation set including 10 reworded cases. Paraphrase (150) is a wording challenge deliberately selected for disagreement between keyword rules and concept labels. None of these sets was used for training; all use synthetic rubric labels rather than clinical ground truth.", "",
             "## Accuracy and latency", "",
             "| Split | Model | N | Acuity | Recommendation | Schema valid | p50 | p95 |",
             "|---|---|---:|---:|---:|---:|---:|---:|"]
    for split, systems in results.items():
        for name, result in systems.items():
            m = result["metrics"]
            lines.append(f"| {split} | {NAMES[name]} | {m['n']} | {m['acuity_exact']:.1%} | {m['rec_match']:.1%} | {m['schema_valid']:.1%} | {m['latency_p50_ms']/1000:.3f}s | {m['latency_p95_ms']/1000:.3f}s |")
    lines += ["", "## API costs", "", "| Model | 490 requests | Per request | Per 1,000 |", "|---|---:|---:|---:|"]
    for name, splits in costs.items():
        total = sum(value["total_usd"] for value in splits.values())
        lines.append(f"| {NAMES[name]} | ${total:.4f} | ${total/490:.6f} | ${total/490*1000:.2f} |")
    lines += ["", "Cache hit rates differ between runs. For comparison, pricing every input token at the ordinary uncached rate (no cache reads or writes) gives:", ""]
    for name, splits in costs.items():
        total = sum(value["uncached_input_reference_usd"] for value in splits.values())
        lines.append(f"- {NAMES[name]}: ${total:.4f} for 490 requests, or ${total/490*1000:.2f} per 1,000.")
    lines += ["", "Costs use recorded input, cached input and output tokens at standard rates. GPT-6 Luna: $0.10/$0.01/$0.50 per million tokens, plus the $0.025/M premium on cache-write input tokens (total write rate $0.125/M); mini: $0.75/$0.075/$4.50. Smoke tests excluded. These are estimates, not invoices.", "",
              "Pricing: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [GPT-5.4-mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini).", "",
              "Qwen has no model API fee in this self-hosted setup. Net savings require subtracting hosting, amortized training and operations; the cluster's billed rate is unknown. Covered hackathon compute does not establish free production hosting.", "",
              "## Needs-more-info behavior", "", "| Split | Model | Precision | Recall |", "|---|---|---:|---:|"]
    def pct(value):
        return "—" if value is None else f"{value:.1%}"
    for split, systems in results.items():
        for name, result in systems.items():
            m = result["metrics"]
            lines.append(f"| {split} | {NAMES[name]} | {pct(m['nmi_precision'])} | {pct(m['nmi_recall'])} |")
    lines += ["", "## Method and limits", "",
              "Same 490 held-out requests, full rubric prompt, schema and scoring. Both GPT runs use reasoning=none, strict structured outputs with a result envelope removed before scoring, a 600-token cap, and sequential requests. GPT settings differ only by model. No prompt tuning on these evaluation sets.", "",
              "Qwen uses vLLM guided decoding on one H100 MIG 1g.10gb slice via the laptop SSH tunnel; OpenAI uses its API over the internet. Latencies reflect different hardware and serving paths. First requests included. Recorded finish reasons reveal any token-cap truncation.", "",
              "Labels come from a synthetic demo rubric, not clinical ground truth. Base Qwen filtered the generated bank, paraphrases were selected for keyword-rule disagreements, and demo cases were curated. These are single-run measurements, not proof of real-world superiority.", "",
              "Raw outputs and metrics for all four models are under results/. Inputs, labels and reference code are under inputs/ (code snapshots depend on the repository). summary.json holds metrics, rates and hashes; per-request-costs.json holds 980 individual GPT usage records. Original three-model archive is preserved. Files are saved outside gitignored runs/; not committed or pushed.", ""]
    (OUT / "README.md").write_text("\n".join(lines))
    (OUT / "per-request-costs.json").write_text(json.dumps(per_case, indent=2) + "\n")
    (OUT / "disagreements.json").write_text(json.dumps(disagreements, indent=1) + "\n")
    summary = {"metrics": {s: {n: r["metrics"] for n, r in systems.items()} for s, systems in results.items()},
               "costs": costs, "rates_per_million_input_cached_output": RATES, "luna_cache_write_rate_per_million": .125,
               "sha256": {str(p.relative_to(OUT)): hashlib.sha256(p.read_bytes()).hexdigest()
                          for p in sorted(OUT.rglob("*")) if p.is_file() and p.name != "summary.json"}}
    (OUT / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(OUT / "README.md")


if __name__ == "__main__":
    main()
