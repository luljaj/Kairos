"""Evaluate a system on a jsonl split (test / demo) on the real serving path.

python eval/evaluate.py --system rules  --data data/generated/test.jsonl --out runs/r1/eval-rules-test.json
python eval/evaluate.py --system http --base-url http://localhost:8000/v1 --model qwen3-4b-dispatch-lora \
       --data data/generated/test.jsonl --out runs/r1/eval-ft-test.json [--guided]

Stdlib only (plus jsonschema) so it runs on the laptop or the cluster.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import statistics
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "data"))
import rubric  # noqa: E402
from jsonschema import Draft202012Validator  # noqa: E402

RES_SCHEMA = json.loads((ROOT / "schemas/model-response.json").read_text())
RES_V = Draft202012Validator(RES_SCHEMA)


def strip_keys(x, keys=("uniqueItems",)):
    """vLLM's xgrammar backend rejects uniqueItems; decode with a stripped copy, validate with the full schema."""
    if isinstance(x, dict):
        return {k: strip_keys(v, keys) for k, v in x.items() if k not in keys}
    if isinstance(x, list):
        return [strip_keys(v, keys) for v in x]
    return x


GUIDED_SCHEMA = strip_keys(RES_SCHEMA)
SYSTEM = (ROOT / "prompt.md").read_text().strip()
from generate import SHORT_SYSTEM as SHORT, reason_names_level  # noqa: E402


def rules_system(req: dict) -> dict:
    """Deterministic fallback: same rubric, no experience exception (mirrors backend fallback)."""
    from generate import NMI_REASONS, NMI_UNRESPONSIVE, acuity_reason, reason_for, summary_of  # noqa
    rng = random.Random(0)
    lab = rubric.label(req, use_experience_exception=False)
    if lab["status"] == "needs_more_info":
        pool = NMI_UNRESPONSIVE if lab["rule"] == "needs_more_info_unresponsive" else NMI_REASONS
        return {"status": "needs_more_info", "acuity": None, "missingFields": lab["missingFields"], "reason": pool[0]}
    by = {c["ambulanceId"]: c for c in req["candidates"]}
    order = sorted(req["candidates"], key=lambda c: (c["ambulanceId"] != lab["recommendedAmbulanceId"], rubric._arr(c)))
    return {"status": "ready", "acuityReason": acuity_reason(rng, req["incident"]["facts"], None, lab),
            "acuity": lab["acuity"], "summary": summary_of(rng, req["incident"]["facts"], "reported"),
            "recommendedAmbulanceId": lab["recommendedAmbulanceId"],
            "candidates": [{"ambulanceId": c["ambulanceId"], "crewSuitable": lab["suitable"][c["ambulanceId"]],
                            "reason": reason_for(rng, c, lab, lab["acuity"], by.get(lab["fastestSuitable"]))} for c in order]}


def http_system(base_url, model, guided, api_key, timeout=60, system=None):
    system = system or SYSTEM

    def call(req: dict):
        body = {"model": model, "temperature": 0, "max_tokens": 600,
                "messages": [{"role": "system", "content": system},
                             {"role": "user", "content": json.dumps(req, separators=(",", ":"))}]}
        if guided:
            body["response_format"] = {"type": "json_schema",
                                       "json_schema": {"name": "ModelResponse", "schema": GUIDED_SCHEMA}}
        r = urllib.request.Request(base_url.rstrip("/") + "/chat/completions", data=json.dumps(body).encode(),
                                   headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"})
        with urllib.request.urlopen(r, timeout=timeout) as f:
            out = json.loads(f.read())
        return out["choices"][0]["message"]["content"]
    return call


def score(req, gold_lab, text):
    gold_ready = gold_lab["status"] == "ready"
    m = {"schema_valid": False, "coverage": False, "status_match": False, "acuity_exact": False,
         "acuity_within1": False, "rec_match": False if gold_ready else None,
         "suit_acc": 0.0 if gold_ready else None, "reasons_grounded": None,
         "pred_status": None, "pred_acuity": None, "kind": gold_lab.get("kind")}
    try:
        resp = json.loads(text) if isinstance(text, str) else text
    except json.JSONDecodeError:
        return m
    m["schema_valid"] = RES_V.is_valid(resp)
    if not isinstance(resp, dict):
        return m
    m["pred_status"] = resp.get("status")
    m["pred_acuity"] = resp.get("acuity")
    if not m["schema_valid"]:
        return m
    if resp["status"] == "ready":
        ar = resp["acuityReason"]
        m["reason_consistent"] = reason_names_level(ar, resp["acuity"])
        m["reason_grounded"] = rubric.numbers_grounded(ar, req)
    if resp["status"] != gold_lab["status"]:
        return m
    m["status_match"] = True
    ga = gold_lab.get("acuity")
    pa = resp["acuity"]
    m["acuity_exact"] = pa == ga
    if ga in rubric.ACUITY_ORDER and pa in rubric.ACUITY_ORDER:
        m["acuity_within1"] = abs(rubric.ACUITY_ORDER.index(ga) - rubric.ACUITY_ORDER.index(pa)) <= 1
    else:
        m["acuity_within1"] = pa == ga
    if not gold_ready:
        m["coverage"] = True
        return m
    ids = [c["ambulanceId"] for c in req["candidates"]]
    cs = resp["candidates"]
    pids = [c["ambulanceId"] for c in cs]
    m["coverage"] = sorted(pids) == sorted(ids) and resp["recommendedAmbulanceId"] in ids
    m["rec_match"] = resp["recommendedAmbulanceId"] == gold_lab["recommendedAmbulanceId"]
    allowed = rubric.allowed_numbers(req)
    good = {c["ambulanceId"]: c for c in cs if c["ambulanceId"] in gold_lab["suitable"]}
    m["suit_acc"] = sum(c["crewSuitable"] == gold_lab["suitable"][cid] for cid, c in good.items()) / len(ids)
    texts = [c["reason"] for c in good.values()]
    m["reasons_grounded"] = (sum(rubric.numbers_grounded(t, req, allowed) for t in texts) / len(texts)) if texts else 0.0
    return m


def aggregate(rows):
    def mean(k, sub=None):
        xs = [r[k] for r in (sub or rows) if r.get(k) is not None]
        return round(sum(map(float, xs)) / len(xs), 4) if xs else None
    lat = sorted(r["latency_ms"] for r in rows if r.get("latency_ms") is not None)
    nmi_pred = [r for r in rows if r["schema_valid"] and r["pred_status"] == "needs_more_info"]
    nmi_gold = [r for r in rows if r["gold_status"] == "needs_more_info"]
    exc = [r for r in rows if r.get("kind") == "experience_exception"]
    agg = {
        "n": len(rows),
        "schema_valid": mean("schema_valid"), "coverage": mean("coverage"),
        "acuity_exact": mean("acuity_exact"), "acuity_within1": mean("acuity_within1"),
        "nmi_precision": round(sum(r["gold_status"] == "needs_more_info" for r in nmi_pred) / len(nmi_pred), 4) if nmi_pred else None,
        "nmi_recall": round(sum(r["status_match"] for r in nmi_gold) / len(nmi_gold), 4) if nmi_gold else None,
        "rec_match": mean("rec_match"), "acuity_reason_consistent": mean("reason_consistent"),
        "acuity_reason_grounded": mean("reason_grounded"), "suit_acc": mean("suit_acc"), "reasons_grounded": mean("reasons_grounded"),
        "exception_cases": len(exc), "exception_rec_match": mean("rec_match", exc) if exc else None,
        "latency_p50_ms": round(statistics.median(lat)) if lat else None,
        "latency_p95_ms": round(lat[min(len(lat) - 1, int(0.95 * len(lat)))]) if lat else None,
    }
    agg["gate_pass"] = bool(agg["schema_valid"] and agg["schema_valid"] >= 0.99 and (agg["rec_match"] or 0) >= 0.95
                            and agg["acuity_exact"] >= 0.90 and (agg["latency_p95_ms"] is None or agg["latency_p95_ms"] <= 2000))
    return agg


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--system", choices=["rules", "http"], required=True)
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--base-url", default=os.environ.get("MODEL_BASE_URL", "http://localhost:8000/v1"))
    ap.add_argument("--model", default="qwen3-4b-dispatch-lora")
    ap.add_argument("--api-key", default=os.environ.get("MODEL_API_KEY", "none"))
    ap.add_argument("--guided", action="store_true")
    ap.add_argument("--concurrency", type=int, default=1, help="1 = sequential (honest latency)")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--short-prompt", action="store_true",
                    help="use the training-only one-line prompt (tests whether the rubric is in the weights)")
    a = ap.parse_args()

    items = [json.loads(l) for l in open(a.data)]
    if a.limit:
        items = items[: a.limit]
    sysfn = rules_system if a.system == "rules" else http_system(a.base_url, a.model, a.guided, a.api_key,
                                                                    system=SHORT if a.short_prompt else None)

    def run(it):
        req = it["meta"]["request"]
        t0 = time.perf_counter()
        try:
            out, err = sysfn(req), None
        except Exception as e:  # noqa
            out, err = "", repr(e)
        ms = (time.perf_counter() - t0) * 1000
        s = score(req, it["meta"]["label"], out)
        s.update(latency_ms=ms if a.system == "http" else None, gold_status=it["meta"]["label"]["status"],
                 gold_acuity=it["meta"]["label"].get("acuity"), family=it["meta"].get("family"),
                 id=req["requestId"], error=err, output=out if isinstance(out, str) else json.dumps(out))
        return s

    with ThreadPoolExecutor(max_workers=a.concurrency) as ex:
        rows = list(ex.map(run, items))
    agg = aggregate(rows)
    if a.concurrency > 1:
        agg["latency_note"] = f"measured at concurrency {a.concurrency}"
    meta = {"short_prompt": a.short_prompt, "system": a.system, "model": a.model if a.system == "http" else "rules", "guided": a.guided,
            "data": a.data, "base_url": a.base_url if a.system == "http" else None}
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps({"meta": meta, "metrics": agg, "rows": rows}, indent=1))
    print(json.dumps({**meta, **agg}, indent=2))


if __name__ == "__main__":
    main()
