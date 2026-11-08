"""Build a training-only follow-up with concise output and paired decision boundaries."""
from __future__ import annotations

import argparse
import json
import random
import shutil
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "data"))

import rubric
from generate import SHORT_SYSTEM, SYSTEM, build_response, mins, sample_candidates, user_content, verify
from verify import ask, same_meaning


# Plain descriptions stay separate from the held-out slang and indirect wording.
# (complaint, concepts, consciousness, normal breathing, summary phrase)
TEXT_CASES = [
    ("Patient lost consciousness and has not regained it", "unconscious", (None, None, True), (True, None, False),
     "after loss of consciousness"),
    ("Witness confirms the patient is currently unconscious", "unconscious", (None, None, True), (True, None, False),
     "reported unconscious"),
    ("The person was found unconscious in the hallway", "unconscious", (None, None, True), (True, None, False),
     "found unconscious"),
    ("Patient is still unconscious after a short fall onto the landing", "unconscious+fracture", (None, None, True),
     (True, None, False), "after a fall"),
    ("Caller saw a fall but cannot tell whether the patient is awake", "fracture+unresponsive_hint", (None,),
     (None, True), "after a fall"),
    ("The caller has not been able to confirm whether the patient is conscious", "unresponsive_hint", (None,),
     (None, True), "with possible unresponsiveness"),
    ("Patient can barely say a few words because breathing is so difficult", "severe_breathing", (None, True),
     (None, False), "with severe breathing difficulty"),
    ("The patient is breathing with effort but answering in complete sentences", "moderate_breathing", (None, True),
     (None, False), "with breathing difficulty"),
    ("Food is blocking the patient's throat completely. There is no air or voice", "choking+no_air", (None, True),
     (None, False), "with a blocked airway"),
    ("A low-speed collision in the parking lot left the patient with wrist pain", "fracture", (None, True),
     (None, True), "after a collision"),
    ("Patient hurt their leg in a short fall and cannot put weight on it", "fracture", (None, True),
     (None, True), "after a fall with leg injury"),
    ("A heavy truck hit the pedestrian as they crossed the road", "major_trauma", (None, True),
     (None, True), "struck by a vehicle"),
    ("Patient was struck in the face and has a swollen cheek after the assault", "assault", (None, True),
     (None, True), "after an assault"),
    ("Minor throat irritation and a low fever. Speaking and breathing normally", "minor", (True,),
     (True,), "with sore throat and fever"),
    ("The patient bruised their shin bumping a table and is walking normally", "minor", (True,),
     (True,), "with a small bruise"),
    ("Food came out after a brief choking episode. Patient is talking and breathing normally", "minor", (True,),
     (True,), "after a resolved choking episode"),
]


def compact_reasons(req, resp, lab):
    if resp["status"] != "ready":
        return
    candidates = {c["ambulanceId"]: c for c in req["candidates"]}
    fastest = candidates.get(lab["fastestSuitable"])
    for result in resp["candidates"]:
        c = candidates[result["ambulanceId"]]
        rec = c["ambulanceId"] == lab["recommendedAmbulanceId"]
        arrival = c["arrivalInSeconds"]
        eta = f"ETA {mins(arrival)} min" if arrival is not None else "ETA unknown"
        if rec and lab["kind"] == "no_suitable":
            why = "No ALS unit available; fastest BLS unit"
        elif not result["crewSuitable"]:
            why = f"BLS only, {lab['acuity']} needs ALS"
        elif rec and lab["kind"] == "experience_exception":
            delay = arrival - fastest["arrivalInSeconds"]
            months = rubric.chief_months(c) - rubric.chief_months(fastest)
            why = f"ALS, chief has {months} more months, {delay} s later"
        elif lab["kind"] == "experience_exception" and c is fastest:
            why = "ALS, faster with less experienced chief"
        elif rec:
            why = f"{c['careLevel']}, fastest suitable"
        else:
            why = c["careLevel"]
        result["reason"] = f"{why}. {eta}."


def example(rng, req, meta, system):
    req = {**req, "requestId": f"req-{rng.getrandbits(64):016x}"}
    resp, lab = build_response(rng, req, meta["info"], sig=set(meta["concepts"]))
    compact_reasons(req, resp, lab)
    if issue := verify(req, resp, lab):
        raise ValueError(f"{req['requestId']} failed verification ({issue})")
    return {"messages": [{"role": "system", "content": system}, {"role": "user", "content": user_content(rng, req)},
                         {"role": "assistant", "content": json.dumps(resp, separators=(",", ":"))}],
            "meta": {**meta, "request": req, "label": lab}}


def fleet_pairs(rng, source, count):
    """Same case and roster twice, with one of the two exception thresholds crossed."""
    critical = [r["meta"] for r in source if r["meta"]["label"]["acuity"] in ("Delta", "Echo")]
    for i, meta in enumerate(rng.sample(critical, count)):
        req = deepcopy(meta["request"])
        while True:
            req["candidates"] = sample_candidates(rng, force_close=True)
            als = [c for c in req["candidates"] if c["careLevel"] == "ALS"]
            if len(als) == 2:
                break
        fastest, slower = sorted(als, key=rubric._arr)
        chief = next(c for c in slower["crew"] if c["role"] == "crew_chief")
        delay = rng.choice([20, 40, 60, rng.randint(5, 60)])
        gap = rng.choice([24, 25, 36, rng.randint(24, 60)])
        slower["travelSeconds"] = slower["arrivalInSeconds"] = fastest["arrivalInSeconds"] + delay
        chief["monthsOfService"] = rubric.chief_months(fastest) + gap
        system = SHORT_SYSTEM if meta["short_prompt"] else SYSTEM
        for positive in (True, False):
            if not positive:
                if i % 2:
                    slower["travelSeconds"] = slower["arrivalInSeconds"] = fastest["arrivalInSeconds"] + 61
                else:
                    chief["monthsOfService"] = rubric.chief_months(fastest) + 23
            row = example(rng, deepcopy(req), {**meta, "augmentation": "fleet_threshold"}, system)
            assert (row["meta"]["label"]["kind"] == "experience_exception") == positive
            yield row


def text_examples(rng, source, verified):
    for text, concepts, conscious, breathing, gist in verified:
        count = 40 if "unconscious" in concepts else 20
        for _ in range(count):
            req = deepcopy(rng.choice(source)["meta"]["request"])
            req["incident"]["facts"].update(
                chiefComplaint=text, patientCount=1, conscious=rng.choice(conscious),
                breathingNormally=rng.choice(breathing), severeBleeding=None, chestPain=None,
                traumaMechanism=None, hazards=None, callerRelation="bystander", notes=None,
            )
            short = rng.random() < 0.3
            meta = {"split": "train", "family": text, "concepts": sorted(concepts),
                    "short_prompt": short, "info": {"gist": gist}, "augmentation": "text_contrast"}
            yield example(rng, req, meta, SHORT_SYSTEM if short else SYSTEM)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=ROOT / "data/generated")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--verify-url", required=True)
    ap.add_argument("--fleet-pairs", type=int, default=300)
    args = ap.parse_args()
    rng = random.Random(17)
    args.out.mkdir(parents=True, exist_ok=True)
    with (args.data / "train.jsonl").open() as f:
        source = [json.loads(line) for line in f]
    verified, checks = [], []
    with ThreadPoolExecutor(4) as executor:
        seen_by_text = list(executor.map(
            lambda case: ask(args.verify_url, "Qwen/Qwen3-4B-Instruct-2507", case[0]),
            TEXT_CASES,
        ))
    for (text, names, conscious, breathing, gist), seen in zip(TEXT_CASES, seen_by_text, strict=True):
        concepts = set(names.split("+"))
        passed = same_meaning(concepts, seen)
        checks.append({"text": text, "intended": sorted(concepts), "verifier": sorted(seen), "kept": passed})
        if passed:
            verified.append((text, concepts, conscious, breathing, gist))
    (args.out / "text_verification.json").write_text(json.dumps(checks, indent=2) + "\n")
    if not {"unconscious", "unresponsive_hint"} <= set().union(*(e[1] for e in verified)):
        raise ValueError("Verifier must accept both definite unconsciousness and uncertain unresponsiveness")
    rows = [example(rng, row["meta"]["request"], row["meta"], row["messages"][0]["content"]) for row in source]
    rows.extend(fleet_pairs(rng, source, args.fleet_pairs))
    rows.extend(text_examples(rng, source, verified))
    rng.shuffle(rows)
    with (args.out / "train.jsonl").open("w") as f:
        for row in rows:
            f.write(json.dumps(row) + "\n")
    for split in ("val", "test"):
        shutil.copyfile(args.data / f"{split}.jsonl", args.out / f"{split}.jsonl")
    print(f"{len(rows)} training rows from {len(source)} originals and {len(verified)} verified text contrasts")
    print(Counter(r["meta"]["label"].get("rule") for r in rows))
    print("Experience exceptions", sum(r["meta"]["label"].get("kind") == "experience_exception" for r in rows))


if __name__ == "__main__":
    main()
