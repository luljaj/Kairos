"""Sample an incident from the concept-labelled bank (plan/07). Returns (incident, concept_set, info)."""
from __future__ import annotations

import hashlib
import random
import re

from bank import B, GENERIC_HURT, HOLDOUT_STYLE_CONCEPTS, NEGATIONS

U = None
AWAKE = {"conscious": [(True, 6), (U, 3), (False, 1)], "breathingNormally": [(True, 6), (U, 3), (False, 1)]}
MINOR = {"conscious": [(True, 7), (U, 3), (False, 0.3)], "breathingNormally": [(True, 7), (U, 3), (False, 0.3)]}
SICK = {"conscious": [(True, 5), (U, 3), (False, 2)], "breathingNormally": [(True, 4), (U, 3), (False, 3)]}
DOWN = {"conscious": [(False, 6), (U, 4)], "breathingNormally": [(False, 5), (U, 5)]}
TEXT_ONLY_C = {"conscious": [(U, 9), (True, 1)], "breathingNormally": [(True, 4), (U, 5), (False, 1)]}
UNKNOWN = {"conscious": [(U, 8), (True, 1), (False, 1)], "breathingNormally": [(U, 8), (True, 1), (False, 1)]}
PRIORS = {
    "arrest": DOWN, "choking+no_air": {"conscious": [(True, 3), (U, 6), (False, 1)], "breathingNormally": [(False, 6), (U, 4)]},
    "choking": {"conscious": [(True, 7), (U, 3)], "breathingNormally": [(False, 5), (U, 5)]},
    "severe_breathing": {"conscious": [(True, 7), (U, 3)], "breathingNormally": [(False, 7), (U, 3)]},
    "major_trauma": SICK, "fracture": SICK, "unresponsive_hint": TEXT_ONLY_C, "unconscious": TEXT_ONLY_C,
    "minor": MINOR, "": UNKNOWN,
}
SEVERITY = ["arrest", "choking", "unconscious", "severe_breathing", "major_trauma", "chest_pain", "altered",
            "diabetic", "seizure", "moderate_breathing", "overdose", "unresponsive_hint", "fracture", "bleeding",
            "assault", "minor", ""]
GIST = {"arrest": "reported not breathing", "choking": "who is choking", "unconscious": "reported unconscious",
        "severe_breathing": "with severe difficulty breathing", "major_trauma": "after a major trauma mechanism",
        "chest_pain": "with chest pain", "altered": "with altered mental status", "diabetic": "with a diabetic problem",
        "seizure": "after a seizure", "moderate_breathing": "with breathing difficulty",
        "overdose": "after a possible overdose", "unresponsive_hint": "who may be unresponsive",
        "fracture": "with a fall or injury", "bleeding": "with a bleeding wound", "assault": "after an assault",
        "minor": "with a minor problem", "": "with an unclear complaint"}

RAW = {
    "family": [("my dad", "male", (50, 90)), ("my mom", "female", (45, 90)), ("my husband", "male", (25, 85)),
               ("my wife", "female", (25, 85)), ("my son", "male", (2, 30)), ("my daughter", "female", (2, 30)),
               ("my grandma", "female", (65, 98)), ("my grandpa", "male", (65, 98)), ("my brother", "male", (10, 60)),
               ("my sister", "female", (10, 60)), ("my father", "male", (50, 90)), ("my mother", "female", (45, 90)),
               ("my uncle", "male", (40, 80)), ("my boyfriend", "male", (18, 40)), ("my girlfriend", "female", (18, 40))],
    "bystander": [("a man", "male", (18, 85)), ("a woman", "female", (18, 85)), ("this guy", "male", (18, 70)),
                  ("an older lady", "female", (60, 95)), ("an old man", "male", (65, 95)), ("a kid", None, (5, 14)),
                  ("a teenager", None, (13, 19)), ("someone", None, (18, 80)), ("this lady", "female", (20, 70))],
    "other": [("my coworker", None, (20, 65)), ("my neighbor", None, (25, 90)), ("my roommate", None, (18, 35)),
              ("a customer", None, (18, 80)), ("my patient", None, (60, 98)), ("a student", None, (6, 22))],
}
SUMMARY_NOUN = {("my dad", "male"): "Father", ("my father", "male"): "Father", ("my mom", "female"): "Mother",
                ("my mother", "female"): "Mother", ("my husband", "male"): "Husband", ("my wife", "female"): "Wife",
                ("my son", "male"): "Son", ("my daughter", "female"): "Daughter", ("my grandma", "female"): "Grandmother",
                ("my grandpa", "male"): "Grandfather", ("my brother", "male"): "Brother", ("my sister", "female"): "Sister"}
PRON = {"male": ("he", "his", "him"), "female": ("she", "her", "her"), None: ("they", "their", "them")}
FILLERS = ["um", "uh", "like", "okay so", "please", "i mean", "oh god"]

FIRST_PERSON = re.compile(r"(^|\W)(i|i'm|i've|my|me)(\W|$)", re.I)


def is_self_only(text):
    return not re.search(r"\{(p|P|he|his|him)\}", text) and bool(FIRST_PERSON.search(text)) and "{" not in text


def entry_split(i, e):
    concepts, style, reg = e[0], e[1], e[2]
    cs = set(concepts.split("+")) if concepts else set()
    if reg in ("x", "i") and cs & HOLDOUT_STYLE_CONCEPTS:
        return "holdout"
    h = int(hashlib.sha256(f"bank-{i}-{e[3]}".encode()).hexdigest(), 16) % 100
    return "train" if h < 70 else ("val" if h < 85 else "test")


POOLS: dict[str, list[tuple]] = {"train": [], "val": [], "test": [], "holdout": []}
for _i, _e in enumerate(B):
    POOLS[entry_split(_i, _e)].append(_e)


def pick(rng, opts):
    vals, w = zip(*opts)
    return rng.choices(vals, weights=w)[0]


def noise(rng, t):
    t = t.lower()
    if rng.random() < 0.6:
        t = re.sub(r"[,.;]", "", t)
    words = t.split()
    if rng.random() < 0.6:
        words.insert(rng.randrange(len(words) + 1), rng.choice(FILLERS))
    if rng.random() < 0.3:
        idx = [k for k, w in enumerate(words) if len(w) > 5 and w.isalpha()]
        if idx:
            k = rng.choice(idx)
            w = words[k]
            j = rng.randrange(1, len(w) - 2)
            words[k] = w[:j] + w[j + 1] + w[j] + w[j + 2:]
    return " ".join(words)


def render(text, person, P, sex):
    he, his, him = PRON[sex]
    return text.format(p=person, P=P, he=he, his=his, him=him)


def sample_incident(rng, pools):
    pool = [e for p in pools for e in POOLS[p]]
    # balance by concept set, then pick an entry
    by_c: dict[str, list] = {}
    for e in pool:
        by_c.setdefault(e[0], []).append(e)
    keys = sorted(by_c)
    w = [1.3 if k == "" else (0.6 if "+" in k and "unresponsive" in k else 1.0) for k in keys]
    cset_key = rng.choices(keys, weights=w)[0]
    e = rng.choice(by_c[cset_key])

    rel = pick(rng, [("family", 6), ("bystander", 3), ("other", 2), ("self", 1)])
    self_entries = [x for x in pool if is_self_only(x[3]) and x[0] == e[0]]
    if is_self_only(e[3]):
        rel = "self"
    if rel == "self":
        if not is_self_only(e[3]) and self_entries and rng.random() < 0.5:
            e = rng.choice(self_entries)
        if not is_self_only(e[3]) and (e[1] != "s" or "{p}" in e[3] or "{he}" in e[3]):
            rel = "family"
    if rel == "self":
        person, sex, age = "I", pick(rng, [("male", 4), ("female", 4), (None, 2)]), rng.randint(18, 85)
        P = "Caller"
    else:
        person, sex0, (lo, hi) = rng.choice(RAW[rel])
        sex = sex0 if sex0 else pick(rng, [("male", 4), ("female", 4), (None, 2)])
        age = rng.randint(lo, hi)
        P = SUMMARY_NOUN.get((person, sex)) or {"male": rng.choice(["Man", "Male", "Adult male"]),
                                                "female": rng.choice(["Woman", "Female", "Adult female"])}.get(sex, "Patient")
        if age < 16 and person in ("a kid", "a teenager", "a student"):
            P = {"male": "Boy", "female": "Girl"}.get(sex, "Child")

    concepts = set(e[0].split("+")) if e[0] else set()
    is_trauma_field = len(e) > 4 and e[4] == "trauma"
    regs = {e[2]}
    if is_trauma_field:
        mech = render(e[3], person, P, sex)
        gen = rng.choice([g for g in GENERIC_HURT if rel != "self" or "{P}" in g])
        complaint = render(gen, person, P, sex)
    else:
        mech = None
        complaint = render(e[3], person, P, sex)
        # two complaints in one sentence (highest wins)
        if rng.random() < 0.15 and e[0] not in ("", "minor"):
            others = [x for x in pool if x[0] not in ("", e[0]) and x[1] == e[1] and len(x) == 4
                      and not is_self_only(x[3]) and rel != "self"]
            if others:
                o = rng.choice(others)
                second = o[3].replace("{P} ", "") if o[1] == "s" else o[3]
                complaint += rng.choice([" and ", ", also ", "; also "]) + render(second, PRON[sex][0], PRON[sex][0], sex).strip()
                complaint = re.sub(r"\s+", " ", complaint)
                concepts |= set(o[0].split("+")) if o[0] else set()
                regs.add(o[2])
    pr = PRIORS.get(e[0]) or PRIORS.get(next(iter(concepts), ""), None) or AWAKE
    if concepts & {"arrest"}:
        pr = DOWN
    facts = {
        "chiefComplaint": complaint, "patientCount": pick(rng, [(1, 8), (None, 2), (2, 0.3)]),
        "patientAge": None if rng.random() < 0.2 else age,
        "patientSex": None if rng.random() < 0.15 else (sex if sex else "other"),
        "conscious": pick(rng, pr["conscious"]), "breathingNormally": pick(rng, pr["breathingNormally"]),
        "severeBleeding": pick(rng, [(False, 5), (U, 3), (True, 2)]) if "bleeding" in concepts else pick(rng, [(U, 8), (False, 2)]),
        "chestPain": pick(rng, [(True, 7), (U, 3)]) if "chest_pain" in concepts else pick(rng, [(U, 7), (False, 3)]),
        "traumaMechanism": mech, "hazards": None if rng.random() < 0.9 else rng.choice(
            ["icy driveway", "dog on scene", "traffic on scene", "smoke in the building", "narrow stairwell"]),
        "callerRelation": None if rng.random() < 0.1 else rel,
        "notes": rng.choice(["on blood thinners", "history of heart problems", "door is unlocked", "lives alone",
                             "second floor apartment", "speaks Spanish", "allergic to penicillin"]) if rng.random() < 0.2 else None,
    }
    if rel == "self" and facts["conscious"] is False:
        facts["conscious"] = True
    # negation / resolved add-on
    neg = None
    if rng.random() < 0.2 and not (concepts == set() and facts["conscious"] is None and facts["breathingNormally"] is None):
        cand = [n for n in NEGATIONS if not (("chest" in n[0] and "chest_pain" in concepts) or
                                             ("bleeding" in n[0] and "bleeding" in concepts) or
                                             ("fall" in n[0] and concepts & {"fracture", "major_trauma"}) or
                                             ("choking" in n[0] and "choking" in concepts) or
                                             ("seizure" in n[0] and "seizure" in concepts) or
                                             ("diabetic" in n[0] and "diabetic" in concepts) or
                                             ("talking" in n[0] and concepts & {"arrest", "unconscious", "unresponsive_hint"}) or
                                             ("breathing" in n[0] and concepts & {"arrest", "severe_breathing", "moderate_breathing", "choking"}))]
        if rel == "self":
            cand = [n for n in cand if "{he}" not in n[0]]
        if cand:
            neg, implies = rng.choice(cand)
            for k, v in implies.items():
                if facts[k] is None or rng.random() < 0.5:
                    facts[k] = v  # half the time align, otherwise structured field wins over text
            he, his, _ = PRON[sex]
            facts["chiefComplaint"] += rng.choice([", ", ". ", " - "]) + neg.format(he=he if rel != "self" else "I", his=his)
            regs.add("n")
    if e[1] == "r" and rng.random() < 0.35:
        facts["chiefComplaint"] = noise(rng, facts["chiefComplaint"])
        regs.add("noise")
    if facts["chiefComplaint"]:
        facts["chiefComplaint"] = facts["chiefComplaint"][0].upper() + facts["chiefComplaint"][1:] if rng.random() < 0.6 \
            else facts["chiefComplaint"]
    if rng.random() < 0.03:
        facts["chiefComplaint"], concepts = None, (concepts if mech else set())
    loc_conf = pick(rng, [("confirmed", 6), ("approximate", 3), (None, 1)])
    loc = {"text": None if loc_conf is None else f"{rng.randint(1, 999)} {rng.choice(['Riverside Dr', 'Main St', 'Oak Ave', 'Front St', 'Vestal Pkwy', 'Court St', 'Elm St', 'Glenwood Ave', 'Leroy St', 'Hawley St'])} (fictional)",
           "confidence": loc_conf}
    top = next((c for c in SEVERITY if c in concepts), "")
    info = {"entry": e[3], "style": e[1], "registers": sorted(regs), "negation": neg, "gist": GIST[top],
            "self": rel == "self"}
    return {"location": loc, "facts": facts}, concepts, info
