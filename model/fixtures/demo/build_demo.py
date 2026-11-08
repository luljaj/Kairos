"""30 hand-checked demo scenarios and 10 paraphrases (eval only) -> fixtures/demo/demo.jsonl

Fleet mirrors plan/00-overview.md: Medic 1 BLS closest, Medic 2 ALS mid, Medic 3 ALS farther / often busy.
Each case states the EXPECTED acuity and recommendation by hand; the script asserts rubric.py agrees,
so a rubric change that breaks the demo fails loudly.
TODO when web/fixtures/scenarios/ exists: re-sync complaints and fleet numbers with it.
"""
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "data"))
from generate import SYSTEM, build_response, verify  # noqa: E402

M1 = [{"role": "driver", "qualifications": ["nys_emt", "hf_driver_cleared"], "monthsOfService": 14},
      {"role": "crew_chief", "qualifications": ["nys_emt", "hf_crew_chief_cleared"], "monthsOfService": 30}]
M2 = [{"role": "driver", "qualifications": ["nys_emt", "hf_driver_cleared"], "monthsOfService": 22},
      {"role": "crew_chief", "qualifications": ["nys_paramedic", "hf_als_cleared", "hf_crew_chief_cleared"], "monthsOfService": 41}]
M3 = [{"role": "driver", "qualifications": ["nys_aemt", "hf_driver_cleared"], "monthsOfService": 9},
      {"role": "crew_chief", "qualifications": ["nys_paramedic", "hf_als_cleared", "hf_crew_chief_cleared"], "monthsOfService": 66}]


def cand(i, avail, travel):
    crew, care = {1: (M1, "BLS"), 2: (M2, "ALS"), 3: (M3, "ALS")}[i]
    return {"ambulanceId": f"amb-{i}", "careLevel": care, "crew": crew, "availableInSeconds": avail,
            "travelSeconds": travel, "arrivalInSeconds": avail + travel}


FLEET_MAIN = [cand(1, 0, 240), cand(2, 0, 360), cand(3, 900, 420)]  # main demo call
FLEET_BUSY = [cand(1, 0, 300), cand(2, 600, 330), cand(3, 420, 380)]  # scripted third call: M2 & M3 busy
FLEET_CLOSE = [cand(1, 0, 200), cand(2, 0, 330), cand(3, 0, 370)]  # M3 40 s slower, chief +25 months
FLEET_BLS_ONLY = [cand(1, 0, 260)]
FLEET_M1_M2 = [cand(1, 0, 240), cand(2, 0, 360)]

BASE = dict(chiefComplaint=None, patientCount=1, patientAge=None, patientSex=None, conscious=None,
            breathingNormally=None, severeBleeding=None, chestPain=None, traumaMechanism=None, hazards=None,
            callerRelation=None, notes=None)

# (id, facts overrides, fleet, expected acuity or None for needs_more_info, expected rec)
CASES = [
    ("main-fall-unconscious", dict(chiefComplaint="My dad fell down the stairs, he's not answering me", patientAge=67,
                                   patientSex="male", conscious=False, breathingNormally=True, traumaMechanism="fall down stairs",
                                   callerRelation="family"), FLEET_MAIN, "Delta", "amb-2"),
    ("main-fall-early", dict(chiefComplaint="My dad fell down the stairs, he's not answering me", callerRelation="family"),
     FLEET_MAIN, None, None),
    ("collapse-unknown", dict(chiefComplaint="My mom collapsed", callerRelation="family"), FLEET_MAIN, None, None),
    ("collapse-now-known", dict(chiefComplaint="My mom collapsed", patientAge=72, patientSex="female", conscious=False,
                                breathingNormally=False, callerRelation="family"), FLEET_MAIN, "Echo", "amb-2"),
    ("third-call-chest", dict(chiefComplaint="My husband has chest pain", patientAge=58, patientSex="male", conscious=True,
                              breathingNormally=True, chestPain=True, callerRelation="family"), FLEET_BUSY, "Charlie", "amb-3"),
    ("third-call-chest-sweaty", dict(chiefComplaint="My husband has chest pain and is sweating", patientAge=58, patientSex="male",
                                     conscious=True, breathingNormally=True, chestPain=True, callerRelation="family"),
     FLEET_BUSY, "Delta", "amb-3"),
    ("arrest-cpr", dict(chiefComplaint="He's not breathing, we started CPR", patientAge=61, patientSex="male",
                        callerRelation="bystander"), FLEET_MAIN, "Echo", "amb-2"),
    ("choking-blue", dict(chiefComplaint="My son is choking and turning blue", patientAge=4, patientSex="male", conscious=True,
                          callerRelation="family"), FLEET_MAIN, "Echo", "amb-2"),
    ("exception-delta", dict(chiefComplaint="Woman struggling to breathe", patientAge=70, patientSex="female", conscious=True,
                             breathingNormally=False, callerRelation="bystander"), FLEET_CLOSE, "Delta", "amb-3"),
    ("exception-not-for-charlie", dict(chiefComplaint="He is having an asthma attack", patientAge=30, patientSex="male",
                                       conscious=True, breathingNormally=False, callerRelation="family"), FLEET_CLOSE, "Charlie", "amb-2"),
    ("exception-echo", dict(chiefComplaint="Found him on the floor, not breathing", patientAge=80, patientSex="male",
                            conscious=False, breathingNormally=False, callerRelation="family"), FLEET_CLOSE, "Echo", "amb-3"),
    ("bls-only-delta", dict(chiefComplaint="Crash on the highway, driver trapped", patientAge=35, conscious=True,
                            breathingNormally=True, traumaMechanism="high-speed crash", hazards="traffic on scene",
                            callerRelation="bystander"), FLEET_BLS_ONLY, "Delta", "amb-1"),
    ("bls-only-alpha", dict(chiefComplaint="I have a fever and a sore throat", patientAge=24, patientSex="female", conscious=True,
                            breathingNormally=True, callerRelation="self"), FLEET_BLS_ONLY, "Alpha", "amb-1"),
    ("minor-cut", dict(chiefComplaint="Cut my finger cooking, small cut", patientAge=33, patientSex="male", conscious=True,
                       breathingNormally=True, severeBleeding=False, callerRelation="self"), FLEET_MAIN, "Bravo", "amb-1"),
    ("heavy-bleed", dict(chiefComplaint="She's bleeding a lot from her leg", patientAge=45, patientSex="female", conscious=True,
                         breathingNormally=True, severeBleeding=True, callerRelation="family"), FLEET_MAIN, "Delta", "amb-2"),
    ("ankle", dict(chiefComplaint="I twisted my ankle, can't put weight on it", patientAge=19, patientSex="female", conscious=True,
                   breathingNormally=True, callerRelation="self"), FLEET_MAIN, "Bravo", "amb-1"),
    ("diabetic", dict(chiefComplaint="My grandpa is diabetic and his sugar is low", patientAge=81, patientSex="male",
                      conscious=True, breathingNormally=True, callerRelation="family"), FLEET_MAIN, "Charlie", "amb-2"),
    ("seizure-stopped", dict(chiefComplaint="She had a seizure, it stopped now", patientAge=27, patientSex="female",
                             conscious=True, breathingNormally=True, callerRelation="bystander"), FLEET_MAIN, "Charlie", "amb-2"),
    ("overdose-awake", dict(chiefComplaint="My roommate took too many pills", patientAge=21, conscious=True,
                            breathingNormally=True, callerRelation="other"), FLEET_MAIN, "Charlie", "amb-2"),
    ("overdose-unconscious", dict(chiefComplaint="My roommate took too many pills", patientAge=21, conscious=False,
                                  breathingNormally=True, callerRelation="other"), FLEET_MAIN, "Delta", "amb-2"),
    ("confused", dict(chiefComplaint="My mother is confused and doesn't know where she is", patientAge=77, patientSex="female",
                      conscious=True, breathingNormally=True, callerRelation="family"), FLEET_MAIN, "Charlie", "amb-2"),
    ("assault", dict(chiefComplaint="A man got punched outside the bar, nose is bleeding", patientAge=29, patientSex="male",
                     conscious=True, breathingNormally=True, severeBleeding=False, hazards="assailant may be nearby",
                     callerRelation="bystander"), FLEET_MAIN, "Bravo", "amb-1"),
    ("hip-fall", dict(chiefComplaint="My grandma fell and hurt her hip", patientAge=88, patientSex="female", conscious=True,
                      breathingNormally=True, callerRelation="family"), FLEET_M1_M2, "Bravo", "amb-1"),
    ("roof-fall", dict(chiefComplaint="My neighbor fell off the roof", patientAge=52, patientSex="male", conscious=True,
                       traumaMechanism="fall from roof", callerRelation="other"), FLEET_MAIN, "Delta", "amb-2"),
    ("chest-young", dict(chiefComplaint="My chest hurts after lifting weights", patientAge=22, patientSex="male", conscious=True,
                         breathingNormally=True, chestPain=True, callerRelation="self"), FLEET_MAIN, "Charlie", "amb-2"),
    ("rash", dict(chiefComplaint="My daughter has a rash", patientAge=6, patientSex="female", conscious=True,
                  breathingNormally=True, callerRelation="family"), FLEET_MAIN, "Alpha", "amb-1"),
    ("unwell-unknown", dict(chiefComplaint="Something is wrong with my husband", patientAge=60, patientSex="male",
                            callerRelation="family"), FLEET_MAIN, None, None),
    ("no-complaint-yet", dict(callerRelation="bystander"), FLEET_MAIN, None, None),
    ("struck-by-car", dict(chiefComplaint="A kid was hit by a car", patientAge=10, conscious=True, breathingNormally=True,
                           traumaMechanism="hit by a car", callerRelation="bystander"), FLEET_M1_M2, "Delta", "amb-2"),
    ("allergy-gasping", dict(chiefComplaint="Allergic reaction, she is gasping", patientAge=34, patientSex="female",
                             conscious=True, breathingNormally=False, callerRelation="family"), FLEET_BUSY, "Delta", "amb-3"),
]

# Reuse the original facts and expected answers. Supply concepts explicitly so the
# keyword baseline cannot change the gold label just because the wording changes.
PARAPHRASES = [
    ("main-fall-early", {"chiefComplaint": "Dad took a tumble down the stairs and won't talk to me"},
     {"fracture", "unresponsive_hint"}),
    ("third-call-chest-sweaty", {"chiefComplaint": "My husband says it feels like a weight on his chest and his skin is clammy"},
     {"chest_pain", "chest_extra"}),
    ("arrest-cpr", {"chiefComplaint": "His chest isn't moving and we're doing compressions"},
     {"arrest"}),
    ("choking-blue", {"chiefComplaint": "Food is wedged in my son's throat, he can't make a sound and his lips have gone purple"},
     {"choking", "no_air"}),
    ("bls-only-alpha", {"chiefComplaint": "I feel like I'm burning up and it hurts to swallow"},
     {"minor"}),
    ("ankle", {"chiefComplaint": "I turned my ankle under me and now I can't stand on that leg"},
     {"fracture"}),
    ("diabetic", {"chiefComplaint": "My grandpa checks his glucose for his condition and the meter reads LOW"},
     {"diabetic"}),
    ("seizure-stopped", {"chiefComplaint": "She went stiff and her whole body jerked over and over. It ended and she's awake now"},
     {"seizure"}),
    ("overdose-awake", {"chiefComplaint": "My roommate swallowed way more of their medication than the bottle says to take"},
     {"overdose"}),
    ("roof-fall", {"chiefComplaint": "My neighbor came off the top of his house while clearing the gutters",
                   "traumaMechanism": "Dropped from gutter height to the ground"},
     {"major_trauma"}),
]


def main():
    out, bad = [], []
    originals = {cid: (over, fleet, acu, rec) for cid, over, fleet, acu, rec in CASES}
    cases = [(*case, None) for case in CASES]
    for source, wording, sig in PARAPHRASES:
        over, fleet, acu, rec = originals[source]
        cases.append((f"{source}-paraphrase", {**over, **wording}, fleet, acu, rec, sig))
    for cid, over, fleet, acu, rec, sig in cases:
        facts = {**BASE, **over}
        req = {"requestId": f"req-demo-{cid}", "incident": {"location": {"text": "14 Riverside Dr (fictional)",
                                                                           "confidence": "confirmed"}, "facts": facts},
               "candidates": json.loads(json.dumps(fleet))}
        resp, lab = build_response(random.Random(cid), req, {"gist": "reported", "name": cid}, sig=sig)
        if lab.get("acuity") != acu or lab.get("recommendedAmbulanceId") != rec:
            bad.append((cid, acu, rec, lab.get("acuity"), lab.get("recommendedAmbulanceId"), lab["rule"]))
        if issue := verify(req, resp, lab):
            bad.append((cid, issue))
        meta = {"split": "demo", "family": cid, "category": "demo", "label": lab, "request": req}
        if sig is not None:
            meta.update(concepts=sorted(sig), paraphrase_of=cid.removesuffix("-paraphrase"))
        out.append({"messages": [{"role": "system", "content": SYSTEM},
                                 {"role": "user", "content": json.dumps(req, separators=(",", ":"))},
                                 {"role": "assistant", "content": json.dumps(resp, separators=(",", ":"))}],
                    "meta": meta})
    if bad:
        for b in bad:
            print("MISMATCH", b)
        sys.exit(1)
    p = Path(__file__).with_name("demo.jsonl")
    p.write_text("".join(json.dumps(r) + "\n" for r in out))
    print(f"wrote {len(out)} demo cases -> {p}")


if __name__ == "__main__":
    main()
