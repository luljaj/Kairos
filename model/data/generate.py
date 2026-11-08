"""Scenario generator -> data/generated/{train,val,test}.jsonl

Each line: {"messages": [system, user, assistant], "meta": {...}}.
Labels come from rubric.py; prose is templated and then verified (rubric match,
grounded numbers, <=20-word reasons, schema). Failures are dropped and counted.

Usage: python data/generate.py [--seed 7] [--train 3000 --val 300 --test 300]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "data"))

import rubric  # noqa: E402
import scenario  # noqa: E402
from jsonschema import Draft202012Validator  # noqa: E402

SYSTEM = (ROOT / "prompt.md").read_text().strip()
# Training-only: a share of train rows use this one-liner so the rubric must live in the weights.
# Serving and every eval use the full prompt.md (fair base-vs-finetuned comparison).
SHORT_SYSTEM = ("You are the dispatch decision-support model for the fictional ambulance demo. Apply the demo acuity "
                "rubric and candidate rules you were trained on and return exactly one JSON object.")
SHORT_PROMPT_SHARE = 0.3
REQ_V = Draft202012Validator(json.loads((ROOT / "schemas/model-request.json").read_text()))
RES_V = Draft202012Validator(json.loads((ROOT / "schemas/model-response.json").read_text()))

PEOPLE = {
    "family": [("my dad", "male", (50, 90)), ("my mom", "female", (45, 90)), ("my husband", "male", (25, 85)),
               ("my wife", "female", (25, 85)), ("my son", "male", (2, 30)), ("my daughter", "female", (2, 30)),
               ("my grandma", "female", (65, 98)), ("my grandpa", "male", (65, 98)),
               ("my brother", "male", (10, 60)), ("my sister", "female", (10, 60)),
               ("my father", "male", (50, 90)), ("my mother", "female", (45, 90))],
    "bystander": [("a man", "male", (18, 85)), ("a woman", "female", (18, 85)), ("this guy", "male", (18, 70)),
                  ("an older lady", "female", (60, 95)), ("a kid", None, (5, 14)), ("a teenager", None, (13, 19)),
                  ("someone", None, (18, 80)), ("a jogger", None, (20, 60))],
    "other": [("my coworker", None, (20, 65)), ("my neighbor", None, (25, 90)), ("my roommate", None, (18, 35)),
              ("a customer", None, (18, 80)), ("my patient", None, (60, 98)), ("a student", None, (6, 22))],
}
PRON = {"male": ("he", "his", "him"), "female": ("she", "her", "her"), None: ("they", "their", "them")}
STREETS = ["Riverside Dr", "Main St", "Oak Ave", "Front St", "Vestal Pkwy", "Court St", "Elm St", "Glenwood Ave",
           "Murray Hill Rd", "Washington Ave", "Chenango St", "Leroy St", "Hawley St", "Clinton St", "Lake St"]
NOTES = ["on blood thinners", "history of heart problems", "dog in the yard", "door is unlocked",
         "lives alone", "patient is pregnant", "caller is very upset", "second floor apartment",
         "wheelchair user", "speaks Spanish", "gate code given", "allergic to penicillin"]
HAZARDS = ["icy driveway", "dog on scene", "traffic on scene", "smoke in the building", "narrow stairwell"]


def pick(rng, opts):
    vals, w = zip(*opts)
    return rng.choices(vals, weights=w)[0]


def sample_incident(rng, fam):
    rel = pick(rng, [("family", 6), ("bystander", 3), ("other", 2), ("self", 1 if fam["selfp"] else 0)])
    if rel == "self":
        phrase = rng.choice(fam["selfp"])
        sex = rng.choice(["male", "female", None])
        age = rng.randint(18, 85)
    else:
        person, sex, (lo, hi) = rng.choice(PEOPLE[rel])
        if sex is None:
            sex = pick(rng, [("male", 4), ("female", 4), (None, 2)])
        he, his, him = PRON[sex]
        phrase = rng.choice(fam["phr"]).format(p=person, he=he, his=his, him=him)
        if rng.random() < 0.5:  # caller-ish casing / punctuation variety
            phrase = phrase[0].upper() + phrase[1:]
        age = rng.randint(lo, hi)
    if rng.random() < 0.2:
        age = None
    pr = fam["priors"]
    facts = {
        "chiefComplaint": phrase,
        "patientCount": pick(rng, [(1, 8), (None, 2), (2, 0.3)]),
        "patientAge": age,
        "patientSex": None if rng.random() < 0.15 else (sex if sex else "other"),
        "conscious": pick(rng, pr["conscious"]),
        "breathingNormally": pick(rng, pr["breathingNormally"]),
        "severeBleeding": pick(rng, pr.get("severeBleeding", [(None, 7), (False, 3)])),
        "chestPain": pick(rng, pr.get("chestPain", [(None, 7), (False, 3)])),
        "traumaMechanism": pick(rng, pr.get("traumaMechanism", [(None, 1)])),
        "hazards": pick(rng, pr.get("hazards", [(None, 9)] + [(h, 0.2) for h in HAZARDS])),
        "callerRelation": None if rng.random() < 0.1 else rel,
        "notes": rng.choice(NOTES) if rng.random() < 0.25 else None,
    }
    if rng.random() < 0.05:  # complaint not captured yet
        facts["chiefComplaint"] = None
    if rel == "self" and facts["conscious"] is False:
        facts["conscious"] = True
    loc_conf = pick(rng, [("confirmed", 6), ("approximate", 3), (None, 1)])
    loc = {"text": None if loc_conf is None else f"{rng.randint(1, 999)} {rng.choice(STREETS)} (fictional)",
           "confidence": loc_conf}
    return {"location": loc, "facts": facts}


def make_crew(rng, als):
    chief_q = ["nys_paramedic", "hf_als_cleared", "hf_crew_chief_cleared"] if als else \
        [rng.choice(["nys_emt", "nys_aemt"]), "hf_crew_chief_cleared"]
    crew = [{"role": "driver", "qualifications": [rng.choice(["nys_emt", "nys_aemt"]), "hf_driver_cleared"],
             "monthsOfService": rng.randint(2, 80)},
            {"role": "crew_chief", "qualifications": chief_q, "monthsOfService": rng.randint(6, 140)}]
    if rng.random() < 0.25:
        crew.append({"role": "attendant", "qualifications": [rng.choice(["nys_emt", "nys_aemt"])],
                     "monthsOfService": rng.randint(1, 60)})
    if rng.random() < 0.5:
        rng.shuffle(crew)
    return crew


def make_ids(rng, n):
    style = rng.random()
    if style < 0.6:
        ids = rng.sample(["amb-1", "amb-2", "amb-3"], n)
    elif style < 0.85:
        ids = [f"amb-{x}" for x in rng.sample(range(1, 40), n)]
    else:
        ids = ["amb-" + "".join(rng.choices("abcdef0123456789", k=4)) for _ in range(n)]
    return ids if len(set(ids)) == n else make_ids(rng, n)


def sample_candidates(rng, force_close=False):
    n = pick(rng, [(3, 6), (2, 3), (1, 1)])
    if force_close:
        n = max(n, 2)
    ids = make_ids(rng, n)
    cands = []
    for i in range(n):
        als = rng.random() < 0.6
        avail = 0 if rng.random() < 0.65 else rng.randint(2, 30) * 60 + rng.randint(0, 59)
        travel = rng.randint(90, 1200)
        if rng.random() < 0.04:
            travel = None
        cands.append({"ambulanceId": ids[i], "careLevel": "ALS" if als else "BLS", "crew": make_crew(rng, als),
                      "availableInSeconds": avail, "travelSeconds": travel,
                      "arrivalInSeconds": None if travel is None else avail + travel})
    if force_close:  # experience-exception neighbourhood: two ALS units, close arrivals, varied chief gap
        a, b = cands[0], cands[1]
        for c in (a, b):
            c["careLevel"] = "ALS"
            c["crew"] = make_crew(rng, True)
            c["availableInSeconds"] = 0
        a["travelSeconds"] = rng.randint(120, 600)
        b["travelSeconds"] = a["travelSeconds"] + rng.choice([rng.randint(5, 60), rng.randint(5, 60), rng.randint(61, 150)])
        gap = rng.choice([rng.randint(24, 70), rng.randint(24, 70), rng.randint(0, 23), -rng.randint(0, 40)])
        ca = rubric.chief_months(a)
        for p in b["crew"]:
            if p["role"] == "crew_chief":
                p["monthsOfService"] = max(0, ca + gap)
        a["arrivalInSeconds"], b["arrivalInSeconds"] = a["travelSeconds"], b["travelSeconds"]
        rng.shuffle(cands)
    return cands


# --- prose ----------------------------------------------------------------
def mins(s):
    return max(1, round(s / 60))


def summary_of(rng, facts, gist):
    age, sex, n = facts["patientAge"], facts["patientSex"], facts["patientCount"]
    noun = {"male": "man", "female": "woman"}.get(sex, "person")
    if age is not None and age < 16:
        noun = {"male": "boy", "female": "girl"}.get(sex, "child")
    head = f"{age}-year-old {noun}" if age is not None else {"male": "Male patient", "female": "Female patient"}.get(sex, "Patient")
    if n is not None and n > 1:
        head = f"{n} patients; {head}"
    bits = []
    c, b = facts["conscious"], facts["breathingNormally"]
    if c is True:
        bits.append("conscious")
    elif c is False:
        bits.append("unconscious")
    if b is True:
        bits.append("breathing normally")
    elif b is False:
        bits.append("not breathing normally")
    if facts["severeBleeding"] is True:
        bits.append("severe bleeding")
    if facts["chiefComplaint"] is None:
        gist = "with no complaint recorded yet"
    s = f"{head} {gist}"
    if bits:
        s += ", " + (" and ".join(bits) if len(bits) <= 2 else ", ".join(bits[:-1]) + " and " + bits[-1])
    if facts["hazards"] and rng.random() < 0.5:
        s += f"; hazard: {facts['hazards']}"
    s = s[0].upper() + s[1:] + "."
    return s[:200]


def eta_text(rng, c):
    if c["arrivalInSeconds"] is None:
        return "arrival time unknown"
    m = mins(c["arrivalInSeconds"])
    if c["availableInSeconds"]:
        return rng.choice([f"busy, free in about {mins(c['availableInSeconds'])} min; arrives in about {m} minutes",
                           f"finishing current work; arrives in about {m} minutes"])
    return rng.choice([f"arrives in about {m} minutes", f"about {m} minutes away", f"ETA about {m} minutes"])


def reason_for(rng, c, lab, acuity, fastest):
    cid = c["ambulanceId"]
    care = c["careLevel"]
    suit = lab["suitable"][cid]
    rec = cid == lab["recommendedAmbulanceId"]
    eta = eta_text(rng, c)
    cm = rubric.chief_months(c)
    if lab["kind"] == "no_suitable":
        if rec:
            return f"No ALS unit available; fastest BLS unit. {eta[0].upper() + eta[1:]}."
        return f"BLS only; {acuity} needs ALS. {eta[0].upper() + eta[1:]}."
    if not suit:
        return rng.choice([f"BLS only; {acuity} call needs ALS. {eta[0].upper() + eta[1:]}.",
                           f"BLS crew, below required ALS level; {eta}."])
    if rec and lab["kind"] == "experience_exception":
        fm = rubric.chief_months(fastest)
        d = int(c["arrivalInSeconds"] - fastest["arrivalInSeconds"])
        return rng.choice([f"ALS; crew chief has {cm} months of service vs {fm}, only {d} s slower; {eta}.",
                           f"Only {d} s slower but crew chief has {cm - fm} more months of service; {eta}."])
    if rec:
        return rng.choice([f"{care} crew, fastest suitable; {eta}.", f"{care} crew; {eta}.",
                           f"Fastest {care} unit; {eta}."])
    if lab["kind"] == "experience_exception" and cid == lab["fastestSuitable"]:
        return f"{care} crew and fastest, but crew chief has less experience ({cm} months); {eta}."
    if c["availableInSeconds"]:
        return f"{care} crew, but slower; {eta}."
    return rng.choice([f"{care} crew, but slower; {eta}.", f"Suitable {care} crew, not the fastest; {eta}."])


def compact_reasons(req, resp, lab):
    if resp["status"] != "ready":
        return
    candidates = {c["ambulanceId"]: c for c in req["candidates"]}
    fastest = candidates.get(lab["fastestSuitable"])
    for result in resp["candidates"]:
        c = candidates[result["ambulanceId"]]
        rec = c["ambulanceId"] == lab["recommendedAmbulanceId"]
        arrival = c["arrivalInSeconds"]
        eta = f"ETA {round(arrival / 60)} min" if arrival is not None else "ETA unknown"
        if rec and lab["kind"] == "no_suitable":
            why = "No ALS unit available; fastest BLS unit"
        elif not result["crewSuitable"]:
            why = f"BLS only, {lab['acuity']} needs ALS"
        elif rec and lab["kind"] == "experience_exception":
            delay = arrival - fastest["arrivalInSeconds"]
            months = rubric.chief_months(c) - rubric.chief_months(fastest)
            comparison = f"{delay} s later" if delay else "same arrival"
            why = f"ALS, chief has {months} more months, {comparison}"
        elif lab["kind"] == "experience_exception" and c is fastest:
            why = "ALS, less experienced chief"
        elif rec:
            why = f"{c['careLevel']}, fastest suitable"
        else:
            why = c["careLevel"]
        result["reason"] = f"{why}. {eta}."


NMI_UNRESPONSIVE = [
    "The complaint suggests the patient may be unresponsive; confirm consciousness before suggesting acuity.",
    "Possible unresponsiveness reported but consciousness is unknown; ask whether the patient is awake.",
    "Need to confirm whether the patient is conscious before suggesting acuity.",
]

# --- acuity reasons (written before the label; plan: model must say WHY) ----------------------
LEVEL_RULE_TEXT = {  # rule -> (evidence from field, evidence from text)
    "unconscious_and_not_breathing": ("Unconscious and not breathing normally (conscious = false, breathingNormally = false)",
                                      "Reported unconscious and not breathing normally"),
    "arrest_words": (None, "Complaint describes no breathing, no pulse or CPR in progress"),
    "choking_no_air": (None, "Choking with no air moving"),
    "unconscious": ("Patient is unconscious (conscious = false)", "Complaint says the patient is unconscious now"),
    "severe_breathing": (None, "Severe breathing difficulty described"),
    "choking_some_air": (None, "Choking with something still stuck, some air moving"),
    "severe_bleeding": ("Severe bleeding reported (severeBleeding = true)", None),
    "chest_pain_age_plus_symptom": ("Chest pain at age {age} with abnormal breathing (breathingNormally = false)",
                                    "Chest pain at age {age} plus another symptom"),
    "major_trauma": (None, "Major trauma mechanism described"),
    "chest_pain": ("Chest pain reported (chestPain = true), no added red flags",
                   "Chest pain or pressure described, no added red flags"),
    "altered_mental_status": (None, "Altered mental status described (confusion, slurred speech or similar)"),
    "diabetic": (None, "Diabetic or blood-sugar problem described"),
    "seizure": (None, "Seizure described"),
    "moderate_breathing": ("Not breathing normally (breathingNormally = false)", "Moderate breathing difficulty described"),
    "overdose_conscious": (None, "Possible overdose described"),
    "fall_or_fracture": (None, "Fall or injury with possible fracture"),
    "bleeding_controlled": (None, "Bleeding wound that is not severe"),
    "assault_conscious": (None, "Assault with injury described"),
    "minor": (None, "Minor problem only, no red flags"),
}


def acuity_reason(rng, facts, sig, lab):
    rule, level = lab["rule"], lab["acuity"]
    s = set(sig) if sig is not None else rubric.signals(facts)
    if rule == "severe_breathing" and "severe_breathing" not in s and "choking" in s:
        rule = "choking_some_air"
    field_ev, text_ev = LEVEL_RULE_TEXT[rule]
    from_field = {
        "unconscious_and_not_breathing": facts.get("conscious") is False,
        "unconscious": facts.get("conscious") is False,
        "severe_bleeding": True,
        "chest_pain_age_plus_symptom": "chest_extra" not in s,
        "chest_pain": facts.get("chestPain") is True and "chest_pain" not in s,
        "moderate_breathing": "moderate_breathing" not in s,
    }.get(rule, False)
    ev = (field_ev if from_field and field_ev else text_ev).format(age=facts.get("patientAge"))
    if rule == "chest_pain" and ("chest_extra" in s or facts.get("breathingNormally") is False):
        age = facts.get("patientAge")
        ev = ("Chest pain with another symptom, but age unknown" if age is None
              else f"Chest pain with another symptom, but age {age} is under 35")
    care = rubric.REQUIRED_CARE[level]
    if rule == "minor" and not facts.get("chiefComplaint") and not facts.get("traumaMechanism"):
        ev = "No red flags in the reported facts"
    return rng.choice([f"{ev}, so {level}; {care} required.", f"{ev}: {level}, needs {care}.",
                       f"{ev}, which makes it {level} ({care})."])


NMI_REASONS = [
    "Cannot assess without knowing whether the patient is conscious and breathing normally.",
    "Consciousness and breathing status are unknown and the complaint does not settle acuity.",
    "Need to know if the patient is awake and breathing normally before suggesting acuity.",
]


def build_response(rng, req, fam, sig=None):
    lab = rubric.label(req, sig=sig)
    # separate stream so adding reasons never changes the sampled incidents (verifier cache stays valid)
    rng2 = random.Random("reason-" + req["requestId"])
    if lab["status"] == "needs_more_info":
        pool = NMI_UNRESPONSIVE if lab["rule"] == "needs_more_info_unresponsive" else NMI_REASONS
        return {"status": "needs_more_info", "acuity": None, "missingFields": lab["missingFields"],
                "reason": rng.choice(pool)}, lab
    cands = req["candidates"]
    by_id = {c["ambulanceId"]: c for c in cands}
    fastest = by_id.get(lab["fastestSuitable"])
    order = sorted(cands, key=lambda c: (c["ambulanceId"] != lab["recommendedAmbulanceId"], rubric._arr(c), c["ambulanceId"]))
    out = [{"ambulanceId": c["ambulanceId"], "crewSuitable": lab["suitable"][c["ambulanceId"]],
            "reason": reason_for(rng, c, lab, lab["acuity"], fastest)} for c in order]
    return {"status": "ready", "acuityReason": acuity_reason(rng2, req["incident"]["facts"], sig, lab),
            "acuity": lab["acuity"],
            "summary": summary_of(rng, req["incident"]["facts"], fam["gist"]),
            "recommendedAmbulanceId": lab["recommendedAmbulanceId"], "candidates": out}, lab


def reason_names_level(text, level):
    """The reason must name exactly one level, and it must be the chosen one."""
    named = [lv for lv in rubric.ACUITY_ORDER if lv in text]
    return named == [level]


def verify(req, resp, lab) -> str | None:
    """Return a failure reason, or None if OK. Shared with eval (eval.metrics)."""
    if not REQ_V.is_valid(req):
        return "request_schema"
    if not RES_V.is_valid(resp):
        return "response_schema"
    if resp["status"] != lab["status"]:
        return "status"
    if resp["status"] == "needs_more_info":
        return None
    if resp["acuity"] != lab["acuity"]:
        return "acuity"
    if not reason_names_level(resp.get("acuityReason", ""), resp["acuity"]):
        return "acuity_reason_level"
    if resp["recommendedAmbulanceId"] != lab["recommendedAmbulanceId"]:
        return "recommendation"
    ids = [c["ambulanceId"] for c in resp["candidates"]]
    if sorted(ids) != sorted(c["ambulanceId"] for c in req["candidates"]):
        return "coverage"
    allowed = rubric.allowed_numbers(req)
    for c in resp["candidates"]:
        if c["crewSuitable"] != lab["suitable"][c["ambulanceId"]]:
            return "suitability"
        if len(c["reason"].split()) > 20:
            return "reason_length"
        if not rubric.numbers_grounded(c["reason"], req, allowed):
            return "reason_numbers"
    if not rubric.numbers_grounded(resp["acuityReason"], req, allowed):
        return "acuity_reason_numbers"
    if not rubric.numbers_grounded(resp["summary"], req, allowed):
        return "summary_numbers"
    return None


def user_content(rng, req):
    return json.dumps(req, indent=2) if rng.random() < 0.15 else json.dumps(req, separators=(",", ":"))


SPLIT_POOLS = {"train": ["train"], "val": ["val"], "test": ["test", "holdout"], "paraphrase": ["test", "holdout"]}


def gen_split(rng, n, split):
    rows, drops = [], {}
    i = 0
    while len(rows) < n:
        i += 1
        inc, sig, info = scenario.sample_incident(rng, SPLIT_POOLS[split])
        force = rng.random() < 0.3
        req = {"requestId": f"req-{split}-{i:05d}", "incident": inc, "candidates": sample_candidates(rng, force)}
        resp, lab = build_response(rng, req, {"gist": info["gist"]}, sig)
        kw = rubric.label(req, use_experience_exception=True)  # keyword baseline label
        if split == "paraphrase" and kw.get("acuity") == lab.get("acuity") and kw["status"] == lab["status"]:
            continue  # paraphrase set: only cases the keyword rules get wrong
        bad = verify(req, resp, lab)
        if bad:
            drops[bad] = drops.get(bad, 0) + 1
            continue
        short = split == "train" and random.Random("prompt-" + req["requestId"]).random() < SHORT_PROMPT_SHARE
        rows.append({"messages": [{"role": "system", "content": SHORT_SYSTEM if short else SYSTEM},
                                  {"role": "user", "content": user_content(rng, req)},
                                  {"role": "assistant", "content": json.dumps(resp, separators=(",", ":"))}],
                     "meta": {"split": split, "short_prompt": short, "family": info["entry"], "concepts": sorted(sig), "info": info,
                              "label": lab, "keyword_label": {"status": kw["status"], "acuity": kw.get("acuity")},
                              "request": req}})
    return rows, drops


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--train", type=int, default=3000)
    ap.add_argument("--val", type=int, default=300)
    ap.add_argument("--test", type=int, default=300)
    ap.add_argument("--paraphrase", type=int, default=150)
    ap.add_argument("--oversample", type=float, default=1.0, help="generate extra so the verifier can drop some")
    ap.add_argument("--out", default=str(ROOT / "data/generated"))
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    stats = {}
    for split, n in (("train", a.train), ("val", a.val), ("test", a.test), ("paraphrase", a.paraphrase)):
        rng = random.Random(f"{a.seed}-{split}")
        rows, drops = gen_split(rng, int(n * a.oversample), split)
        p = out / f"{split}.jsonl"
        p.write_text("".join(json.dumps(r) + "\n" for r in rows))
        dist = {}
        for r in rows:
            k = r["meta"]["label"].get("acuity") or "needs_more_info"
            dist[k] = dist.get(k, 0) + 1
        kinds = {}
        for r in rows:
            k = r["meta"]["label"].get("kind", "nmi")
            kinds[k] = kinds.get(k, 0) + 1
        stats[split] = {"n": len(rows), "dropped": drops, "acuity": dict(sorted(dist.items())), "kind": kinds,
                        "sha256": hashlib.sha256(p.read_bytes()).hexdigest()[:16]}
    (out / "stats.json").write_text(json.dumps(stats, indent=2))
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
