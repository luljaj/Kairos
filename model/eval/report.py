"""Build runs/<run-id>/eval.md from eval JSONs written by evaluate.py.

python eval/report.py --run runs/r1 --files runs/r1/eval-*.json
File naming convention: eval-<system>-<set>.json, system in {base, ft, ftshort, rules} (ftshort = fine-tuned with --short-prompt), set in {test, paraphrase, demo}.
"""
import argparse
import json
from pathlib import Path

COLS = [("schema_valid", "schema"), ("coverage", "coverage"), ("acuity_exact", "acuity"), ("acuity_within1", "acuity±1"),
        ("nmi_precision", "nmi P"), ("nmi_recall", "nmi R"), ("rec_match", "rec"), ("acuity_reason_consistent", "why=level"), ("suit_acc", "suit"),
        ("reasons_grounded", "grounded"), ("exception_rec_match", "exception rec"), ("latency_p50_ms", "p50 ms"),
        ("latency_p95_ms", "p95 ms")]


def fmt(v):
    if v is None:
        return "—"
    return f"{v * 100:.1f}%" if isinstance(v, float) and v <= 1.0 else str(v)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True)
    ap.add_argument("--files", nargs="+", required=True)
    a = ap.parse_args()
    res = {}
    for f in a.files:
        d = json.loads(Path(f).read_text())
        sysname, sset = Path(f).stem.split("-")[1:3]
        res[(sset, sysname)] = d["metrics"]
    out = ["# Evaluation", "",
           "**Labels come from a synthetic demo rubric (model/rubric.py + concept-labelled scenarios). These results "
           "say the model learned the rubric, not that it is clinically right.**", ""]
    for sset in ("test", "paraphrase", "demo"):
        rows = [(s, res[(sset, s)]) for s in ("base", "ft", "ftshort", "rules") if (sset, s) in res]
        if not rows:
            continue
        out += [f"## {sset} (n={rows[0][1]['n']})", "",
                "| system | " + " | ".join(c[1] for c in COLS) + " | gate |",
                "|---|" + "---|" * (len(COLS) + 1)]
        for s, m in rows:
            out.append(f"| {s} | " + " | ".join(fmt(m.get(k)) for k, _ in COLS) + f" | {'pass' if m.get('gate_pass') else 'fail'} |")
        out.append("")
    ft_p, rules_p = res.get(("paraphrase", "ft"), {}), res.get(("paraphrase", "rules"), {})
    if ft_p:
        ok = ft_p["acuity_exact"] >= 0.85 and ft_p["acuity_exact"] > rules_p.get("acuity_exact", 0) + 0.10
        out += [f"**Paraphrase gate** (ft acuity ≥ 85% and clearly above rules): {'PASS' if ok else 'FAIL'} "
                f"(ft {fmt(ft_p['acuity_exact'])} vs rules {fmt(rules_p.get('acuity_exact'))}).", ""]
    out += ["Gate: schema-valid ≥ 99%, recommendation ≥ 95%, acuity exact ≥ 90%, p95 ≤ 2 s (serving path: vLLM FP8 on one "
            "H100 MIG 1g.10gb slice, sequential requests).", ""]
    p = Path(a.run) / "eval.md"
    p.write_text("\n".join(out))
    print(p.read_text())


if __name__ == "__main__":
    main()
