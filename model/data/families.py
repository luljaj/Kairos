"""Complaint families. Split is by family so paraphrases never leak into val/test.

Each family: name, category, phrasings (third person, slots {p}=person phrase, {he}/{his}/{him}),
optional self-phrasings (first person), summary gist, and fact priors.
Priors map a fact to [(value, weight), ...]; missing facts default to mostly-null.
Labels are NOT taken from here — rubric.py computes them from the sampled request.
"""

U = None  # unknown

# Common priors
AWAKE = {"conscious": [(True, 6), (U, 3), (False, 1)], "breathingNormally": [(True, 6), (U, 3), (False, 1)]}
SICK = {"conscious": [(True, 5), (U, 3), (False, 2)], "breathingNormally": [(True, 4), (U, 3), (False, 3)]}
DOWN = {"conscious": [(False, 6), (U, 2), (True, 2)], "breathingNormally": [(False, 5), (U, 3), (True, 2)]}
MINOR = {"conscious": [(True, 7), (U, 3), (False, 0.3)], "breathingNormally": [(True, 7), (U, 3), (False, 0.3)]}
UNKNOWN = {"conscious": [(U, 8), (True, 1), (False, 1)], "breathingNormally": [(U, 8), (True, 1), (False, 1)]}

F = []


def fam(name, cat, phr, gist, priors=None, selfp=None, **extra):
    d = dict(name=name, cat=cat, phr=phr, gist=gist, priors=dict(priors or AWAKE), selfp=selfp or [])
    d["priors"].update(extra)
    F.append(d)


# --- Echo: arrest -------------------------------------------------------
fam("arrest_home", "arrest", [
    "{p} collapsed and is not breathing", "{p} is not breathing, I think {his} heart stopped",
    "{p} stopped breathing and won't wake up", "found {p} on the floor, not breathing",
    "{p} isn't breathing, we're doing cpr"], "who is reported not breathing", DOWN)
fam("arrest_public", "arrest", [
    "{p} dropped at the gym and has no pulse", "{p} went down in the store, no pulse, someone started cpr",
    "{p} in cardiac arrest at the bus stop", "{p} just fell over and isn't breathing"],
    "reported not breathing after collapsing in public", DOWN)
fam("arrest_bed", "arrest", [
    "can't wake {p}, {he} stopped breathing", "{p} is blue in bed and not breathing",
    "I think {p}'s heart stopped, {he}'s cold and not breathing", "{p} has no pulse in {his} bed"],
    "found unresponsive and not breathing", DOWN)

# --- Echo/Delta: choking --------------------------------------------------
fam("choking_food", "choking", [
    "{p} is choking on food and can't breathe", "{p} is choking at dinner, turning blue",
    "{p} is choking, can't talk", "{p} started choking on a piece of meat"],
    "who is choking", {"conscious": [(True, 5), (U, 4), (False, 1)], "breathingNormally": [(False, 5), (U, 5)]})
fam("choking_child", "choking", [
    "{p} is choking on a toy, no air", "{p} swallowed something and is choking",
    "{p} is choking and has blue lips", "{p} is choking and coughing hard"],
    "who is choking on an object", {"conscious": [(True, 5), (U, 5)], "breathingNormally": [(False, 5), (U, 5)]})
fam("choking_restaurant", "choking", [
    "{p} at the next table is choking", "{p} is choking in the restaurant and cannot breathe",
    "{p} is grabbing {his} throat, choking"],
    "choking in a restaurant", {"conscious": [(True, 6), (U, 4)], "breathingNormally": [(False, 6), (U, 4)]})

# --- needs_more_info bait: vague collapse ---------------------------------
fam("collapse_vague", "vague", [
    "{p} collapsed", "{p} just went down", "{p} just dropped in the kitchen", "{p} passed out"],
    "who collapsed", UNKNOWN)
fam("unwell_vague", "vague", [
    "{p} is not feeling well", "something is wrong with {p}", "{p} doesn't look right",
    "{p} is acting really weird and I'm scared"], "who is unwell", UNKNOWN)
fam("found_down", "vague", [
    "found {p} lying on the sidewalk", "{p} is lying in the hallway", "{p} is on the ground outside",
    "there's {p} slumped in a car"], "found lying down", UNKNOWN)
fam("need_help", "vague", [
    "please send someone for {p}", "I need an ambulance for {p}", "{p} needs help", "it's {p}, please hurry"],
    "needing help", UNKNOWN)

# --- Delta: severe breathing ------------------------------------------------
fam("sob_severe_home", "severe_breathing", [
    "{p} can't breathe", "{p} is gasping for air", "{p} is struggling to breathe and turning blue",
    "{p} can barely breathe"], "with severe difficulty breathing",
    {"conscious": [(True, 6), (U, 3), (False, 1)], "breathingNormally": [(False, 7), (U, 3)]},
    selfp=["I can't breathe", "I can barely breathe"])
fam("sob_severe_allergy", "severe_breathing", [
    "{p} got stung and now can't breathe", "{p} ate peanuts, {his} throat is closing and {he} cannot breathe",
    "{p} has blue lips after eating shrimp", "allergic reaction, {p} is gasping"],
    "with an allergic reaction and severe breathing difficulty",
    {"conscious": [(True, 7), (U, 3)], "breathingNormally": [(False, 7), (U, 3)]})
fam("sob_severe_copd", "severe_breathing", [
    "{p} has copd and is struggling to breathe", "{p}'s oxygen ran out, {he} is gasping",
    "{p} with emphysema can't breathe"], "with a lung condition and severe breathing difficulty",
    {"conscious": [(True, 6), (U, 3), (False, 1)], "breathingNormally": [(False, 8), (U, 2)]})

# --- Delta: major trauma ------------------------------------------------------
fam("trauma_crash", "major_trauma", [
    "{p} was in a high speed crash", "car crash on the highway, {p} is trapped",
    "rollover on route 17, {p} was inside", "{p} was ejected from the car"],
    "after a serious vehicle crash", SICK, traumaMechanism=[("high-speed crash", 3), ("rollover", 2), (U, 3)])
fam("trauma_pedestrian", "major_trauma", [
    "{p} was hit by a car", "{p} got struck by a car crossing the street", "{p} was hit by a truck"],
    "struck by a vehicle", SICK, traumaMechanism=[("hit by a car", 4), ("pedestrian struck", 1), (U, 3)])
fam("trauma_height", "major_trauma", [
    "{p} fell from the roof", "{p} fell off scaffolding at work", "{p} fell from the third floor balcony",
    "{p} came off the roof while cleaning gutters"],
    "after a fall from height", SICK, traumaMechanism=[("fall from roof", 3), ("fall from 3rd floor", 1), (U, 3)])

# --- chest pain ------------------------------------------------------------
fam("chest_plain", "chest_pain", [
    "{p} has chest pain", "{p} says {his} chest hurts", "{p} is complaining of chest pressure",
    "{p} has a tight chest"], "with chest pain", AWAKE, chestPain=[(True, 8), (U, 2)],
    selfp=["I have chest pain", "my chest hurts"])
fam("chest_symptoms", "chest_pain", [
    "{p} has chest pain and is sweating", "{p} has chest pain and feels nauseous",
    "{p} has pain in {his} chest and left arm", "{p}'s chest hurts and {he} is dizzy",
    "chest pressure, {p} is short of breath", "{p} has chest pain and is throwing up"],
    "with chest pain and other symptoms", AWAKE, chestPain=[(True, 9), (U, 1)])
fam("chest_young", "chest_pain", [
    "{p} has chest pain after lifting weights", "{p} says there's pressure in {his} chest",
    "{p} has chest pain when breathing in"], "with chest pain", AWAKE, chestPain=[(True, 7), (U, 3)])
fam("chest_jaw", "chest_pain", [
    "{p} has chest pain going up to {his} jaw", "{p}'s chest is tight and {he} feels lightheaded",
    "{p} has chest pressure and a sweaty face"], "with chest pain and other symptoms", AWAKE,
    chestPain=[(True, 9), (U, 1)])

# --- Charlie: altered ------------------------------------------------------
fam("altered_confused", "altered", [
    "{p} is confused and doesn't know where {he} is", "{p} is suddenly disoriented",
    "{p} is not making sense", "{p} is slurring {his} words"], "with altered mental status", AWAKE)
fam("altered_elderly", "altered", [
    "{p} is acting strange and confused today", "{p} woke up disoriented", "{p} is drowsy and confused"],
    "who is confused", AWAKE)
fam("altered_stroke", "altered", [
    "{p}'s face is drooping and {he} is slurring", "{p} is slurring and confused all of a sudden",
    "{p} is disoriented and weak on one side"], "with sudden confusion or slurred speech", AWAKE)

# --- Charlie: diabetic -------------------------------------------------------
fam("diabetic_low", "diabetic", [
    "{p} is diabetic and {his} sugar is low", "{p}'s blood sugar is really low", "{p} took insulin and is shaky"],
    "with a diabetic problem", AWAKE)
fam("diabetic_high", "diabetic", [
    "{p} is diabetic and very sick", "{p}'s blood sugar reads high", "{p} is a diabetic and feels terrible"],
    "with a diabetic problem", AWAKE)
fam("diabetic_kid", "diabetic", [
    "{p} has diabetes, sugar low and sweaty", "{p}'s insulin pump failed", "{p} has type 1 diabetic issues"],
    "with a diabetic problem", AWAKE)

# --- Charlie: seizure --------------------------------------------------------
fam("seizure_stopped", "seizure", [
    "{p} had a seizure, it stopped now", "{p} was convulsing but stopped", "{p} had a seizure on the floor"],
    "after a seizure", AWAKE)
fam("seizure_epilepsy", "seizure", [
    "{p} has epilepsy and had a seizure", "{p} is having a seizure", "{p} was fitting for a minute"],
    "with a seizure", SICK)
fam("seizure_new", "seizure", [
    "{p} just had a convulsion, never happened before", "{p} shook all over, like a seizure",
    "{p} had a seizure at school"], "after a first seizure", AWAKE)

# --- Charlie: moderate breathing ----------------------------------------------
fam("asthma", "moderate_breathing", [
    "{p} is having an asthma attack", "{p}'s asthma is bad and the inhaler isn't helping",
    "{p} is wheezing a lot"], "with an asthma attack", AWAKE,
    breathingNormally=[(False, 5), (U, 3), (True, 2)], selfp=["my asthma is bad"])
fam("sob_moderate", "moderate_breathing", [
    "{p} is short of breath", "{p} is having trouble breathing", "{p} says it's hard to breathe"],
    "who is short of breath", AWAKE, breathingNormally=[(False, 6), (U, 3), (True, 1)])
fam("sob_sick", "moderate_breathing", [
    "{p} has a bad cough and is breathing fast", "{p} has pneumonia and is short of breath",
    "{p} is wheezing with a fever"], "with breathing difficulty", AWAKE,
    breathingNormally=[(False, 5), (U, 4), (True, 1)])

# --- Charlie: overdose -------------------------------------------------------
fam("overdose_pills", "overdose", [
    "{p} took too many pills", "{p} took a bunch of pills on purpose", "{p} overdosed on pills"],
    "after taking too many pills", SICK)
fam("overdose_drugs", "overdose", [
    "{p} overdosed on something", "I think {p} overdosed at a party", "{p} od'd in the bathroom"],
    "with a suspected overdose", SICK)
fam("overdose_med", "overdose", [
    "{p} took a double dose of {his} meds, maybe an overdose", "{p} might have overdosed on sleeping pills"],
    "with a possible medication overdose", AWAKE)

# --- Bravo: fall / fracture -------------------------------------------------
fam("fall_stairs", "fracture", [
    "{p} fell down the stairs", "{p} fell down the stairs and is not answering me",
    "{p} fell down the stairs, {his} leg looks broken", "{p} slipped on the stairs"],
    "after a fall down stairs", SICK, traumaMechanism=[("fall down stairs", 5), (U, 5)])
fam("fall_ice", "fracture", [
    "{p} slipped on ice and hurt {his} wrist", "{p} slipped outside and can't put weight on {his} leg",
    "{p} fell on the ice, arm looks deformed"], "after a slip and fall", AWAKE,
    traumaMechanism=[("slip on ice", 4), (U, 6)])
fam("fall_elderly", "fracture", [
    "{p} fell and hurt {his} hip", "{p} had a fall in the bathroom", "{p} tripped and can't get up"],
    "after a fall", AWAKE, traumaMechanism=[("ground-level fall", 4), (U, 6)])
fam("fracture_sport", "fracture", [
    "{p} broke {his} arm playing soccer", "{p} twisted {his} knee badly and it looks deformed",
    "{p} thinks {he} broke {his} ankle"], "with a possible fracture", AWAKE,
    selfp=["I think I broke my ankle", "I fell and broke my wrist"])

# --- Bravo/Delta: bleeding ---------------------------------------------------
fam("bleeding_kitchen", "bleeding", [
    "{p} cut {his} hand with a knife", "{p} has a deep cut on {his} arm", "{p} has a gash on {his} leg"],
    "with a cut", AWAKE, severeBleeding=[(False, 4), (U, 4), (True, 2)])
fam("bleeding_head", "bleeding", [
    "{p} hit {his} head and it's bleeding", "{p} has a laceration on {his} forehead", "{p}'s head is bleeding"],
    "with a bleeding head wound", AWAKE, severeBleeding=[(False, 4), (U, 4), (True, 2)])
fam("bleeding_heavy", "bleeding", [
    "{p} is bleeding a lot from {his} leg", "{p} is bleeding and it won't stop", "{p} has a lot of blood coming out"],
    "with heavy bleeding", AWAKE, severeBleeding=[(True, 6), (U, 3), (False, 1)])

# --- Bravo: assault ----------------------------------------------------------
fam("assault_bar", "assault", [
    "{p} got punched outside the bar", "{p} was beaten up", "{p} got in a fight and is hurt"],
    "after an assault", AWAKE, hazards=[("assailant may be nearby", 3), (U, 7)],
    traumaMechanism=[("assault", 4), (U, 6)])
fam("assault_street", "assault", [
    "{p} was attacked on the street", "{p} was assaulted and has a swollen face", "{p} got jumped and beaten"],
    "after an assault", AWAKE, hazards=[("police not on scene", 2), (U, 8)], traumaMechanism=[("assault", 4), (U, 6)])
fam("assault_stab", "assault", [
    "{p} was stabbed", "{p} got stabbed in the arm", "{p} was attacked with a knife"],
    "after a stabbing", AWAKE, severeBleeding=[(True, 4), (U, 4), (False, 2)],
    hazards=[("scene may be unsafe", 4), (U, 6)], traumaMechanism=[("stabbing", 5), (U, 5)])

# --- Alpha: minor ------------------------------------------------------------
fam("minor_fever", "minor", [
    "{p} has a fever and a sore throat", "{p} has the flu", "{p} has a bad cold and cough"],
    "with a minor illness", MINOR, selfp=["I have a fever", "I have the flu and feel awful"])
fam("minor_pain", "minor", [
    "{p} has back pain", "{p} has a bad headache", "{p} has a stomach ache", "{p} has a toothache"],
    "reporting pain", MINOR, selfp=["I have bad back pain"])
fam("minor_skin", "minor", [
    "{p} has a rash", "{p} got a bee sting on {his} hand", "{p} has a small burn from the stove"],
    "with a minor skin problem", MINOR)
fam("minor_injury", "minor", [
    "{p} stubbed {his} toe", "{p} has a splinter", "{p} has a nosebleed", "{p} has a bruise on {his} leg",
    "{p} has a scrape on {his} knee"], "with a minor injury", MINOR)
fam("minor_sprain", "minor", [
    "{p} has a sprain", "{p} has an earache", "{p} has a sore throat and earache"],
    "with a minor problem", MINOR)

FAMILIES = {f["name"]: f for f in F}

# Explicit split by family (one per category held out for val and for test where possible).
VAL = {"arrest_bed", "choking_restaurant", "need_help", "sob_severe_copd", "trauma_height", "chest_jaw",
       "altered_stroke", "diabetic_kid", "seizure_new", "sob_sick", "overdose_med", "fracture_sport",
       "bleeding_head", "assault_street", "minor_sprain"}
TEST = {"arrest_public", "choking_child", "found_down", "sob_severe_allergy", "trauma_pedestrian",
        "chest_young", "altered_elderly", "diabetic_high", "seizure_epilepsy", "sob_moderate",
        "overdose_drugs", "fall_ice", "bleeding_kitchen", "assault_bar", "minor_skin"}
TRAIN = set(FAMILIES) - VAL - TEST
