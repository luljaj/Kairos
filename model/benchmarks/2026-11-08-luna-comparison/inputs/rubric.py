"""Single source of truth for labels: acuity, crew suitability, recommendation.

Demo rubric only — simplified, NOT clinical, NOT the licensed IAED MPDS protocol.
Pure function of the model request (plan/05-model-finetune.md). The backend's
deterministic fallback should port `acuity_of` + `recommend(..., use_experience_exception=False)`.

Text signals come from keyword matching over chiefComplaint, traumaMechanism and notes
(lower-cased). The lexicon below is the whole definition; keep it in sync with prompt.md.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

ACUITY_ORDER = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"]
REQUIRED_CARE = {"Echo": "ALS", "Delta": "ALS", "Charlie": "ALS", "Bravo": "BLS", "Alpha": "BLS"}
CARE_RANK = {"BLS": 0, "ALS": 1}

EXPERIENCE_WINDOW_S = 60
EXPERIENCE_GAP_MONTHS = 24

# --- keyword lexicon -------------------------------------------------------
LEX: dict[str, list[str]] = {
    # Echo
    "arrest": ["not breathing", "stopped breathing", "isn't breathing", "no pulse",
               "cardiac arrest", "heart stopped", "doing cpr", "started cpr"],
    "choking": ["choking"],
    "no_air": ["can't breathe", "cannot breathe", "no air", "can't talk", "turning blue", "blue lips"],
    # Delta
    "severe_breathing": ["can't breathe", "cannot breathe", "gasping", "struggling to breathe",
                         "turning blue", "blue lips", "can barely breathe"],
    "major_trauma": ["high speed", "high-speed", "highway", "rollover", "rolled over", "ejected",
                     "hit by a car", "hit by a truck", "struck by a car", "thrown from", "thrown out of", "fell from the roof",
                     "off the roof", "third floor", "3rd floor", "fourth floor", "three storeys",
                     "three stories", "scaffolding"],
    "chest_extra": ["sweating", "sweaty", "nausea", "nauseous", "vomiting", "throwing up",
                    "arm pain", "pain in his arm", "pain in her arm", "left arm", "jaw",
                    "dizzy", "short of breath", "lightheaded"],
    # Charlie
    "chest_pain": ["chest pain", "chest hurts", "pain in his chest", "pain in her chest",
                   "pain in my chest", "chest pressure", "pressure in", "tight chest", "chest is tight"],
    "altered": ["confused", "disoriented", "not making sense", "acting strange", "slurring",
                "doesn't know where", "drowsy and confused"],
    "diabetic": ["diabetic", "diabetes", "blood sugar", "sugar is low", "sugar low", "insulin", "hypoglyc"],
    "seizure": ["seizure", "fitting", "convulsing", "convulsion"],
    "moderate_breathing": ["short of breath", "trouble breathing", "wheezing", "asthma",
                           "hard to breathe", "breathing fast", "can't catch"],
    "overdose": ["overdose", "too many pills", "took a bunch of pills", "overdosed", "od'd"],
    # Bravo
    "fracture": ["fell", "fall", "broken", "broke", "fracture", "twisted", "deformed",
                 "can't put weight", "slipped", "tripped", "crash", "collision", "car accident",
                 "fender bender", "rear-ended"],
    "bleeding": ["bleeding", "cut", "laceration", "gash"],
    "assault": ["assault", "beaten", "punched", "attacked", "got in a fight", "stabbed"],
    # Possible unresponsiveness: with `conscious` unknown, ask before scoring (unless arrest/choking).
    "unresponsive_hint": ["not answering", "not responding", "unresponsive", "won't wake", "can't wake",
                          "won't respond", "not waking up", "passed out"],
    # Text clearly says unconscious now: counts as conscious == false when the field is null.
    "unconscious": ["unconscious", "out cold", "knocked out"],
    # Alpha (only used to decide whether the complaint "settles" needs_more_info)
    "minor": ["sore throat", "fever", "rash", "earache", "back pain", "stubbed", "splinter",
              "nosebleed", "nose bleed", "cold", "flu", "headache", "stomach ache", "sprain",
              "bee sting", "minor burn", "small burn", "toothache", "cough", "bruise", "scrape"],
}

# Any of these present means the complaint itself settles the call (no needs_more_info).
SETTLING = [k for k in LEX if k not in ("chest_extra", "no_air", "unresponsive_hint")]

# Concept names = LEX keys. The generator labels from a concept set (what the scenario means);
# the keyword matcher below is only the rules baseline / backend fallback.
CONCEPTS = list(LEX)


def _text(facts: dict) -> str:
    parts = [facts.get("chiefComplaint"), facts.get("traumaMechanism"), facts.get("notes")]
    return " ".join(p for p in parts if p).lower()


def signals(facts: dict) -> set[str]:
    t = _text(facts)
    found = set()
    for key, words in LEX.items():
        for w in words:
            if re.search(r"(?<![a-z])" + re.escape(w) + r"(?:s|es|ed|d|ing|en)?(?![a-z])", t):
                found.add(key)
                break
    return found


@dataclass
class AcuityResult:
    acuity: str | None  # None => needs_more_info
    rule: str
    missing: list[str] = field(default_factory=list)


def acuity_of(facts: dict, sig: set[str] | None = None) -> AcuityResult:
    """sig: concept set from the scenario (generator). None -> keyword matching (rules baseline).
    Structured fields win over text; text only fills a null field."""
    s = signals(facts) if sig is None else set(sig)
    c, b = facts.get("conscious"), facts.get("breathingNormally")
    if c is None and "unconscious" in s:
        c = False
    age = facts.get("patientAge")
    chest = facts.get("chestPain") is True or "chest_pain" in s

    # Possible unresponsiveness with consciousness unknown -> ask (Echo words still win).
    if c is None and "unresponsive_hint" in s and "arrest" not in s and not ("choking" in s and "no_air" in s):
        missing = ["conscious"] + (["breathingNormally"] if b is None else [])
        return AcuityResult(None, "needs_more_info_unresponsive", missing)

    # needs_more_info when nothing at all settles it.
    if c is None and b is None and not (s & set(SETTLING)) and facts.get("severeBleeding") is not True \
            and facts.get("chestPain") is not True:
        missing = ["conscious", "breathingNormally"]
        if not facts.get("chiefComplaint"):
            missing.insert(0, "chiefComplaint")
        return AcuityResult(None, "needs_more_info", missing)

    # Echo
    if b is False and c is False:
        return AcuityResult("Echo", "unconscious_and_not_breathing")
    if "arrest" in s:
        return AcuityResult("Echo", "arrest_words")
    if "choking" in s and "no_air" in s:
        return AcuityResult("Echo", "choking_no_air")
    # Delta
    if c is False:
        return AcuityResult("Delta", "unconscious")
    if "severe_breathing" in s or "choking" in s:
        return AcuityResult("Delta", "severe_breathing")
    if facts.get("severeBleeding") is True:
        return AcuityResult("Delta", "severe_bleeding")
    if chest and age is not None and age >= 35 and ("chest_extra" in s or b is False):
        return AcuityResult("Delta", "chest_pain_age_plus_symptom")
    if "major_trauma" in s:
        return AcuityResult("Delta", "major_trauma")
    # Charlie
    if chest:
        return AcuityResult("Charlie", "chest_pain")
    if "altered" in s:
        return AcuityResult("Charlie", "altered_mental_status")
    if "diabetic" in s:
        return AcuityResult("Charlie", "diabetic")
    if "seizure" in s:
        return AcuityResult("Charlie", "seizure")
    if "moderate_breathing" in s or b is False:
        return AcuityResult("Charlie", "moderate_breathing")
    if "overdose" in s:
        return AcuityResult("Charlie", "overdose_conscious")
    # Bravo
    if "fracture" in s:
        return AcuityResult("Bravo", "fall_or_fracture")
    if "bleeding" in s:
        return AcuityResult("Bravo", "bleeding_controlled")
    if "assault" in s:
        return AcuityResult("Bravo", "assault_conscious")
    return AcuityResult("Alpha", "minor")


# --- suitability & recommendation -----------------------------------------
def chief_months(cand: dict) -> int | None:
    m = [p["monthsOfService"] for p in cand.get("crew", []) if p["role"] == "crew_chief"]
    return max(m) if m else None


def _arr(c: dict) -> float:
    a = c.get("arrivalInSeconds")
    return math.inf if a is None else a


def suitable(cand: dict, acuity: str) -> bool:
    return CARE_RANK[cand["careLevel"]] >= CARE_RANK[REQUIRED_CARE[acuity]]


@dataclass
class Recommendation:
    recommended: str
    fastest_suitable: str | None
    suitable: dict[str, bool]
    kind: str  # "fastest_suitable" | "experience_exception" | "no_suitable"


def recommend(candidates: list[dict], acuity: str, use_experience_exception: bool = True) -> Recommendation:
    order = sorted(candidates, key=lambda c: (_arr(c), c["ambulanceId"]))
    suit = {c["ambulanceId"]: suitable(c, acuity) for c in candidates}
    ok = [c for c in order if suit[c["ambulanceId"]]]
    if not ok:
        return Recommendation(order[0]["ambulanceId"], None, suit, "no_suitable")
    f = ok[0]
    if use_experience_exception and acuity in ("Echo", "Delta") and f.get("arrivalInSeconds") is not None:
        fm = chief_months(f)
        best = None
        for u in ok[1:]:
            um = chief_months(u)
            if u.get("arrivalInSeconds") is None or fm is None or um is None:
                continue
            if u["arrivalInSeconds"] - f["arrivalInSeconds"] <= EXPERIENCE_WINDOW_S and um - fm >= EXPERIENCE_GAP_MONTHS:
                if best is None or um > chief_months(best):
                    best = u
        if best is not None:
            return Recommendation(best["ambulanceId"], f["ambulanceId"], suit, "experience_exception")
    return Recommendation(f["ambulanceId"], f["ambulanceId"], suit, "fastest_suitable")


def label(request: dict, use_experience_exception: bool = True, sig: set[str] | None = None) -> dict:
    """Structured label (no prose). Generator passes the concept set; rules baseline passes None."""
    facts = request["incident"]["facts"]
    a = acuity_of(facts, sig)
    if a.acuity is None:
        return {"status": "needs_more_info", "acuity": None, "missingFields": a.missing, "rule": a.rule}
    r = recommend(request["candidates"], a.acuity, use_experience_exception)
    return {"status": "ready", "acuity": a.acuity, "rule": a.rule, "recommendedAmbulanceId": r.recommended,
            "fastestSuitable": r.fastest_suitable, "suitable": r.suitable, "kind": r.kind}


# --- grounding check for prose --------------------------------------------
def allowed_numbers(request: dict) -> set[str]:
    nums: set[float] = set()

    def walk(x):
        if isinstance(x, bool) or x is None:
            return
        if isinstance(x, (int, float)):
            nums.add(float(x))
        elif isinstance(x, dict):
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)
        elif isinstance(x, str):
            for m in re.findall(r"\d+(?:\.\d+)?", x):
                nums.add(float(m))

    walk(request["incident"])
    for c in request["candidates"]:
        walk(c)
        for k in ("availableInSeconds", "travelSeconds", "arrivalInSeconds"):
            v = c.get(k)
            if v is not None:
                nums.update({float(round(v / 60)), float(math.floor(v / 60)), float(math.ceil(v / 60))})
        cm = chief_months(c)
        if cm is not None:
            nums.add(float(cm // 12))
    a = [c["arrivalInSeconds"] for c in request["candidates"] if c.get("arrivalInSeconds") is not None]
    for x in a:  # differences between arrivals (e.g. "40 s slower")
        for y in a:
            if x > y:
                d = x - y
                nums.update({float(d), float(round(d / 60)), float(math.ceil(d / 60))})
    ms = [chief_months(c) for c in request["candidates"] if chief_months(c) is not None]
    for x in ms:
        for y in ms:
            if x > y:
                nums.add(float(x - y))
    return {_fmt(n) for n in nums}


def _fmt(n: float) -> str:
    return str(int(n)) if float(n).is_integer() else str(n)


def numbers_grounded(text: str, request: dict, allowed: set[str] | None = None) -> bool:
    allowed = allowed if allowed is not None else allowed_numbers(request)
    return all(_fmt(float(m)) in allowed for m in re.findall(r"\d+(?:\.\d+)?", text))
