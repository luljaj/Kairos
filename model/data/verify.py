"""Second-pass check (plan/07 step 3): a different model reads ONLY the complaint text and names the
concepts it describes. Keep an example only if those concepts give the same acuity as the intended set
under neutral facts. Writes filtered splits + verify_stats.json; caches verdicts by text.

python data/verify.py --in data/generated_raw --out data/generated --base-url http://alphagpu01:8000/v1
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import rubric  # noqa: E402

DEFS = {
    "arrest": "not breathing / no pulse / cardiac arrest / CPR in progress",
    "choking": "choking: something stuck in the throat right now",
    "no_air": "with choking: no air moving at all (can't breathe, can't speak, turning blue)",
    "severe_breathing": "severe breathing difficulty (gasping, can't speak, turning blue, airway swelling)",
    "major_trauma": "major trauma mechanism: high-speed/highway crash, rollover, thrown from vehicle, hit by a vehicle, fall from roof or >= 3 storeys",
    "chest_pain": "chest pain, pressure or tightness",
    "chest_extra": "with chest pain: sweating, nausea/vomiting, arm or jaw pain, dizzy/lightheaded, short of breath",
    "altered": "confusion, disorientation, slurred speech, not making sense",
    "diabetic": "diabetic / blood sugar problem",
    "seizure": "seizure or convulsion (ongoing or just ended)",
    "moderate_breathing": "moderate breathing difficulty (short of breath, wheezing, asthma) but still talking",
    "overdose": "overdose / took too many pills or drugs",
    "fracture": "fall or injury with possible fracture, or a minor vehicle crash",
    "bleeding": "a real wound that is bleeding (not trivial)",
    "assault": "assaulted / beaten / attacked, with injury",
    "unresponsive_hint": "patient may be unresponsive (not answering, won't wake, passed out) but it is not stated as definite",
    "unconscious": "stated clearly to be unconscious right now (out cold, knocked out and still out)",
    "minor": "a clearly minor problem only (minor illness, small cut that stopped, bump, rash, resolved symptom)",
}
SYS = ("You label emergency call summaries. Return the concepts the text describes as CURRENT problems. "
       "Ignore negated or resolved symptoms (e.g. 'no chest pain', 'was choking but it cleared'). "
       "Return an empty list if the text names no specific problem (e.g. 'collapsed', 'something is wrong').\n"
       + "\n".join(f"- {k}: {v}" for k, v in DEFS.items()))
SCHEMA = {"type": "object", "additionalProperties": False, "required": ["concepts"],
          "properties": {"concepts": {"type": "array", "items": {"enum": list(DEFS)}}}}
NEUTRAL = [dict(conscious=None, breathingNormally=None, patientAge=50),
           dict(conscious=True, breathingNormally=True, patientAge=50)]


def text_of(facts):
    parts = [facts.get("chiefComplaint"), facts.get("traumaMechanism") and f"Mechanism: {facts['traumaMechanism']}"]
    return " | ".join(p for p in parts if p)


def same_meaning(a: set, b: set) -> bool:
    """a = intended, b = verifier. Documented relaxation (Nov 7): the 4B verifier usually returns [] for
    clearly minor complaints ("stomach ache since lunch"), which dropped 43% of the scary-but-minor rows
    plan/07 asks for. If the intent is just `minor`, accept any verifier answer naming nothing beyond `minor`."""
    if a == {"minor"} and b <= {"minor"}:
        return True
    for n in NEUTRAL:
        f = {k: None for k in ("chestPain", "severeBleeding")} | n
        x, y = rubric.acuity_of(f, a), rubric.acuity_of(f, b)
        if x.acuity != y.acuity:
            return False
    return True


def ask(base_url, model, text):
    body = {"model": model, "temperature": 0, "max_tokens": 80,
            "messages": [{"role": "system", "content": SYS}, {"role": "user", "content": text}],
            "response_format": {"type": "json_schema", "json_schema": {"name": "Concepts", "schema": SCHEMA}}}
    r = urllib.request.Request(base_url.rstrip("/") + "/chat/completions", data=json.dumps(body).encode(),
                               headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r, timeout=120) as f:
        return set(json.loads(json.loads(f.read())["choices"][0]["message"]["content"])["concepts"])  # dedup here; xgrammar lacks uniqueItems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--base-url", required=True)
    ap.add_argument("--model", default="Qwen/Qwen3-4B-Instruct-2507")
    ap.add_argument("--targets", default="train=3000,val=300,test=300,paraphrase=150")
    ap.add_argument("--concurrency", type=int, default=4)
    a = ap.parse_args()
    inp, out = Path(a.inp), Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    cache_p = inp / "verify_cache.json"
    cache = json.loads(cache_p.read_text()) if cache_p.exists() else {}
    targets = dict(kv.split("=") for kv in a.targets.split(","))
    splits = {s: [json.loads(l) for l in open(inp / f"{s}.jsonl")] for s in targets}
    texts = sorted({text_of(r["meta"]["request"]["incident"]["facts"]) for rows in splits.values() for r in rows} - set(cache) - {""})
    print(f"{len(texts)} unique texts to verify", flush=True)

    def work(t):
        try:
            return t, sorted(ask(a.base_url, a.model, t))
        except Exception as e:  # noqa
            return t, None

    with ThreadPoolExecutor(a.concurrency) as ex:
        for k, (t, c) in enumerate(ex.map(work, texts)):
            cache[t] = c
            if k % 200 == 0:
                print(f"  {k}/{len(texts)}", flush=True)
                cache_p.write_text(json.dumps(cache))
    cache_p.write_text(json.dumps(cache))

    stats = {}
    for s, rows in splits.items():
        kept, drop, by_reg, drops_eg = [], 0, {}, []
        for r in rows:
            t = text_of(r["meta"]["request"]["incident"]["facts"])
            want = set(r["meta"]["concepts"])
            got = cache.get(t, []) if t else []
            ok = got is not None and (t == "" or same_meaning(want, set(got)))
            for reg in r["meta"]["info"]["registers"]:
                d = by_reg.setdefault(reg, [0, 0])
                d[0] += 1
                d[1] += (not ok)
            if ok:
                r["meta"]["verifier_concepts"] = got
                kept.append(r)
            else:
                drop += 1
                if len(drops_eg) < 15:
                    drops_eg.append({"text": t, "intended": sorted(want), "verifier": got})
        kept = kept[: int(targets[s])]
        (out / f"{s}.jsonl").write_text("".join(json.dumps(r) + "\n" for r in kept))
        stats[s] = {"generated": len(rows), "dropped": drop, "drop_rate": round(drop / max(1, len(rows)), 3),
                    "kept": len(kept), "drop_rate_by_register": {k: round(v[1] / v[0], 3) for k, v in by_reg.items()},
                    "drop_examples": drops_eg}
    (out / "verify_stats.json").write_text(json.dumps(stats, indent=2))
    print(json.dumps({s: {k: v for k, v in d.items() if k != "drop_examples"} for s, d in stats.items()}, indent=2))


if __name__ == "__main__":
    main()
