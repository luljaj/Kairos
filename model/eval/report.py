"""Build runs/<run-id>/eval.md from eval JSONs written by evaluate.py.

python eval/report.py --run runs/r1 --files runs/r1/eval-*.json
File naming convention: eval-<system>-<set>.json, with ft reserved for the selected serving mode.
"""
import argparse
import json
from pathlib import Path

COLS = [("schema_valid", "schema"), ("coverage", "coverage"), ("acuity_exact", "acuity"), ("acuity_within1", "acuity±1"),
        ("nmi_precision", "nmi P"), ("nmi_recall", "nmi R"), ("rec_match", "rec"),
        ("acuity_reason_consistent", "why=level"), ("acuity_reason_grounded", "why grounded"), ("suit_acc", "suit"),
        ("reasons_grounded", "grounded"), ("exception_rec_match", "exception rec"), ("latency_p50_ms", "p50 ms"),
        ("latency_p95_ms", "p95 ms")]
SPLITS = ("test", "paraphrase", "demo")
SYSTEMS = ("base", "baseunguided", "ft", "ftguided", "ftunguided", "ftshort", "rules")


def fmt(v):
    if v is None:
        return "—"
    return f"{v * 100:.1f}%" if isinstance(v, float) and v <= 1.0 else str(v)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True)
    ap.add_argument("--files", nargs="+", required=True)
    ap.add_argument("--latency-path", default="sequential requests to the serving endpoint")
    ap.add_argument("--ignore-latency", action="store_true", help="use the test and demo quality thresholds")
    a = ap.parse_args()
    cols = COLS[:-2] if a.ignore_latency else COLS
    res = {}
    for f in a.files:
        d = json.loads(Path(f).read_text())
        sysname, sset = Path(f).stem.split("-")[1:3]
        res[(sset, sysname)] = d
    out = ["# Evaluation", "",
           "**Labels come from a synthetic demo rubric (model/rubric.py + concept-labelled scenarios). These results "
           "say the model learned the rubric, not that it is clinically right.**", ""]
    gates = {}
    for sset in SPLITS:
        rows = [(s, res[(sset, s)]) for s in SYSTEMS if (sset, s) in res]
        if not rows:
            continue
        out += [f"## {sset}", "",
                "| system | decoding | n | " + " | ".join(c[1] for c in cols) + " |",
                "|" + "---|" * (len(cols) + 3)]
        for s, result in rows:
            m, meta = result["metrics"], result["meta"]
            decoding = ("guided" if meta["guided"] else "unguided") if meta["system"] == "http" else "—"
            out.append(f"| {s} | {decoding} | {m['n']} | " + " | ".join(fmt(m.get(k)) for k, _ in cols) + " |")
        out.append("")
        ft = res.get((sset, "ft"))
        if ft is None:
            continue
        if sset == "paraphrase":
            rules = res.get((sset, "rules"))
            ft_acu = ft["metrics"]["acuity_exact"]
            rules_acu = rules["metrics"]["acuity_exact"] if rules else None
            gates[sset] = rules_acu is not None and ft_acu >= 0.85 and ft_acu > rules_acu + 0.10
            out += [f"**Paraphrase gate {'passed' if gates[sset] else 'failed'}.** "
                    f"Fine-tuned acuity {fmt(ft_acu)} versus rules {fmt(rules_acu)}.", ""]
        else:
            gate_key = "quality_gate_pass" if a.ignore_latency else "gate_pass"
            gates[sset] = ft["metrics"][gate_key]
            out += [f"**{sset.capitalize()} gate {'passed' if gates[sset] else 'failed'}.**", ""]
    if len(gates) == len(SPLITS):
        out += [f"**Overall demo gate {'passed' if all(gates.values()) else 'failed'}.**", ""]
    quality = "Test and demo require ≥99% schema validity, ≥95% recommendation accuracy and ≥90% exact acuity"
    threshold = quality + ("." if a.ignore_latency else ", with ≤2 s p95.")
    out += [
        f"{threshold} "
        "The paraphrase gate requires ≥85% exact acuity and more than a 10 percentage point lead over rules.",
        "",
        "Recommendation accuracy includes all gold ready cases. "
        "The why=level metric covers schema-valid ready outputs and targets ≥98%. The ftshort rows use the one-line prompt.",
        "",
    ]
    if not a.ignore_latency:
        out += [f"Latency was measured with {a.latency_path}.", ""]
    p = Path(a.run) / "eval.md"
    p.write_text("\n".join(out))
    print(p.read_text())


if __name__ == "__main__":
    main()
