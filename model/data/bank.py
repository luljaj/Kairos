"""Concept-labelled complaint bank (plan/07). Labels come from the concept set, NOT keywords.

Entry: (concepts, style, register, text[, field])
  concepts : "+"-joined LEX keys the text MEANS ("" = vague, settles nothing). Negated or resolved
             symptoms are NOT listed (e.g. "was choking but it came out" does not carry choking).
  style    : "s" = voice-agent summary, "r" = caller's raw words
  register : "p" plain, "x" slang, "i" indirect, "m" scary-sounding but minor, "n" contains a negation
  field    : optional "trauma" -> text is a traumaMechanism value, complaint gets a generic phrase
Slots: {p} raw person ("my dad"), {P} summary noun ("Father"), {he} {his} {him} {He} {His}.
Written by Claude (Opus 5.5) for this repo; the second-pass verifier is a different model (see verify.py).
"""

B = [
    # ---------------- arrest (Echo) ----------------
    ("arrest", "s", "p", "{P} collapsed, not breathing"),
    ("arrest", "s", "p", "{P} found without a pulse"),
    ("arrest", "s", "p", "{P} in suspected cardiac arrest, bystander CPR started"),
    ("arrest", "s", "p", "{P} stopped breathing at the table"),
    ("arrest", "r", "p", "{he}'s not breathing, oh god, {he}'s not breathing"),
    ("arrest", "r", "p", "I'm doing compressions on {p} right now"),
    ("arrest", "r", "p", "{p} isn't breathing and I can't feel a pulse"),
    ("arrest", "r", "x", "{p} just flatlined on the couch, nothing, no breaths"),
    ("arrest", "r", "x", "{p} dropped and there's no heartbeat"),
    ("arrest", "r", "i", "{p}'s chest isn't moving at all and {he} won't respond"),
    ("arrest", "r", "i", "{p} went grey and limp and there's no breathing that I can see"),
    ("arrest", "s", "i", "{P} not breathing after going limp, caller starting chest compressions"),
    ("arrest", "r", "x", "I think {p}'s heart gave out, {he}'s not taking any breaths"),
    ("arrest", "r", "p", "found {p} in bed, cold, no breathing"),
    ("arrest", "s", "p", "{P} unresponsive with no breathing, AED being brought"),
    ("arrest", "r", "i", "we got the defibrillator on {p}, {he}'s not breathing"),
    ("arrest", "r", "x", "{he} just stopped, {he}'s not breathing, someone is pumping {his} chest"),

    # ---------------- choking with no air (Echo) ----------------
    ("choking+no_air", "s", "p", "{P} choking on food, unable to breathe"),
    ("choking+no_air", "s", "p", "{P} choking, cannot speak, turning blue"),
    ("choking+no_air", "r", "p", "{p} is choking and nothing's going in or out"),
    ("choking+no_air", "r", "x", "{p} got food stuck and can't get any air, {his} lips are going grey"),
    ("choking+no_air", "r", "i", "{p} has something lodged in {his} throat and is clutching it, no sound coming out"),
    ("choking+no_air", "r", "i", "a piece of steak is stuck, {he} can't make a sound and {he}'s going purple"),
    ("choking+no_air", "s", "i", "{P} with an object blocking the airway, no air movement"),
    ("choking+no_air", "r", "x", "{p} swallowed a grape wrong and can't breathe at all"),
    ("choking+no_air", "r", "p", "{p} is choking, I tried the back blows and {he} still can't breathe"),

    # ---------------- choking, still moving air (Delta) ----------------
    ("choking", "s", "p", "{P} choking, coughing forcefully"),
    ("choking", "r", "p", "{p} is choking on a candy but still coughing"),
    ("choking", "r", "i", "something went down the wrong way and {p} keeps gagging and coughing"),
    ("choking", "s", "i", "{P} with food stuck in throat, coughing, some air movement"),
    ("choking", "r", "x", "{p} is hacking on a chicken bone, it's still stuck"),

    # ---------------- severe breathing (Delta) ----------------
    ("severe_breathing", "s", "p", "{P} with severe difficulty breathing"),
    ("severe_breathing", "s", "p", "{P} gasping for air, can barely speak"),
    ("severe_breathing", "r", "p", "{he} can't breathe, {he} can't get words out"),
    ("severe_breathing", "r", "x", "{p} can't catch {his} breath at all, {his} lips are going grey"),
    ("severe_breathing", "r", "x", "{p} is sucking air like a fish and can't talk"),
    ("severe_breathing", "r", "i", "{p} is sitting bolt upright fighting for every breath"),
    ("severe_breathing", "r", "i", "{p}'s throat is swelling shut after the bee sting"),
    ("severe_breathing", "s", "i", "{P} with throat swelling after eating peanuts, struggling for air"),
    ("severe_breathing", "r", "p", "{p} is struggling to breathe and turning blue"),
    ("severe_breathing", "s", "x", "{P} air hungry, one-word answers only"),
    ("severe_breathing", "r", "i", "{p}'s ribs are sucking in with every breath and {he} looks exhausted"),
    ("severe_breathing", "r", "x", "{he}'s wheezing so bad no air's getting in, {he} can't say a sentence"),

    # ---------------- major trauma (Delta) ----------------
    ("major_trauma", "s", "p", "{P} in a high-speed crash on the highway"),
    ("major_trauma", "s", "p", "{P} hit by a car while crossing"),
    ("major_trauma", "s", "p", "{P} fell from a roof"),
    ("major_trauma", "s", "p", "{P} ejected from vehicle in rollover"),
    ("major_trauma", "r", "p", "{p} got hit by a truck in the parking lot"),
    ("major_trauma", "r", "x", "{p} got thrown out of the car when it flipped"),
    ("major_trauma", "r", "x", "{p} came off {his} motorcycle at like 70"),
    ("major_trauma", "r", "i", "{p} came off the top of the house, like 20 feet"),
    ("major_trauma", "r", "i", "{p} went off the ladder from the second story gutter and landed on the driveway"),
    ("major_trauma", "r", "i", "{p}'s car went under a tractor trailer"),
    ("major_trauma", "s", "i", "{P} fell three floors from a balcony"),
    ("major_trauma", "r", "x", "a bus clipped {p} and {he} went flying"),
    ("major_trauma", "s", "x", "{P}, pedestrian struck by SUV"),
    ("major_trauma", "r", "p", "{p} fell off the scaffolding at work, it's really high"),
    ("major_trauma", "r", "i", "the car rolled into the ditch a few times with {p} in it"),
    ("major_trauma", "s", "p", "rollover on the interstate", "trauma"),
    ("major_trauma", "s", "x", "thrown from vehicle", "trauma"),
    ("major_trauma", "s", "i", "fell about 25 feet from a tree stand", "trauma"),
    ("major_trauma", "s", "p", "pedestrian hit by car", "trauma"),
    ("major_trauma", "s", "i", "head-on collision at highway speed", "trauma"),

    # ---------------- chest pain (Charlie) / with extra symptom (Delta if age >= 35) ----------------
    ("chest_pain", "s", "p", "{P} with chest pain"),
    ("chest_pain", "s", "p", "{P} reporting chest tightness"),
    ("chest_pain", "r", "p", "{p} says {his} chest hurts"),
    ("chest_pain", "r", "x", "{p} says it feels like an elephant is sitting on {his} chest"),
    ("chest_pain", "r", "i", "{p} keeps rubbing the middle of {his} chest, says it's heavy"),
    ("chest_pain", "r", "x", "{p}'s got this crushing feeling in {his} chest"),
    ("chest_pain", "s", "i", "{P} with pressure behind the breastbone"),
    ("chest_pain", "r", "p", "I've got a sharp pain in my chest"),
    ("chest_pain", "r", "n", "{p} has chest pain, no trouble breathing, not sweaty"),
    ("chest_pain+chest_extra", "s", "p", "{P} with chest pain and sweating"),
    ("chest_pain+chest_extra", "s", "p", "{P} with chest pressure, nausea"),
    ("chest_pain+chest_extra", "r", "p", "{p} has chest pain going down {his} left arm"),
    ("chest_pain+chest_extra", "r", "x", "{p}'s chest is killing {him} and {he}'s drenched in sweat"),
    ("chest_pain+chest_extra", "r", "i", "{p} has a squeezing in {his} chest that goes up into {his} jaw"),
    ("chest_pain+chest_extra", "r", "x", "{p} has chest pain and keeps throwing up"),
    ("chest_pain+chest_extra", "r", "i", "{p}'s chest feels heavy and {he} went pale and clammy"),
    ("chest_pain+chest_extra", "s", "i", "{P} with chest discomfort, lightheaded and clammy"),
    ("chest_pain+chest_extra", "r", "p", "my chest hurts and I feel like I'm gonna pass out"),

    # ---------------- altered mental status (Charlie) ----------------
    ("altered", "s", "p", "{P} confused and disoriented"),
    ("altered", "s", "p", "{P} with sudden slurred speech"),
    ("altered", "r", "p", "{p} doesn't know where {he} is"),
    ("altered", "r", "x", "{p} is talking gibberish all of a sudden"),
    ("altered", "r", "x", "{p} is totally out of it, not making any sense"),
    ("altered", "r", "i", "{p} didn't recognize me and keeps asking what year it is"),
    ("altered", "r", "i", "{p}'s face is drooping on one side and {his} words are coming out wrong"),
    ("altered", "s", "i", "{P} not oriented to place or time"),
    ("altered", "r", "p", "{p} is acting really confused today"),
    ("altered", "r", "x", "{he}'s loopy and can't follow what I'm saying"),

    # ---------------- diabetic (Charlie) ----------------
    ("diabetic", "s", "p", "{P}, diabetic, low blood sugar"),
    ("diabetic", "s", "p", "{P} with high blood sugar reading"),
    ("diabetic", "r", "p", "{p} is diabetic and {his} sugar is way off"),
    ("diabetic", "r", "x", "{p} is having a sugar crash, shaky and sweaty"),
    ("diabetic", "r", "x", "{p}'s glucose meter just says LO"),
    ("diabetic", "r", "i", "{p} took {his} insulin and didn't eat, now {he}'s shaking"),
    ("diabetic", "s", "i", "{P} on insulin, missed meal, trembling"),
    ("diabetic", "r", "i", "{p}'s insulin pump stopped working and {he} feels awful"),
    ("diabetic", "r", "p", "{p} has type 1 diabetes and is acting off"),

    # ---------------- seizure (Charlie) ----------------
    ("seizure", "s", "p", "{P} had a seizure, now stopped"),
    ("seizure", "s", "p", "{P} with a seizure, history of epilepsy"),
    ("seizure", "r", "p", "{p} had a seizure on the floor"),
    ("seizure", "r", "x", "{p} was shaking all over and foaming, it's stopped now"),
    ("seizure", "r", "i", "{p} went stiff and jerked for about a minute and now {he}'s groggy"),
    ("seizure", "r", "x", "{p} just had a fit at the dinner table"),
    ("seizure", "s", "i", "{P} with full-body jerking for two minutes, now drowsy"),
    ("seizure", "r", "i", "{his} arms and legs were twitching and {his} eyes rolled back"),

    # ---------------- moderate breathing (Charlie) ----------------
    ("moderate_breathing", "s", "p", "{P} short of breath"),
    ("moderate_breathing", "s", "p", "{P} with an asthma attack, inhaler not helping much"),
    ("moderate_breathing", "r", "p", "{p} is having trouble breathing"),
    ("moderate_breathing", "r", "x", "{p} is all wheezy and puffing"),
    ("moderate_breathing", "r", "x", "{p} can't catch {his} breath after climbing the stairs, still talking though"),
    ("moderate_breathing", "r", "i", "{p} gets winded just walking to the bathroom today"),
    ("moderate_breathing", "s", "i", "{P} breathing faster than normal, speaking in full sentences"),
    ("moderate_breathing", "r", "i", "{p}'s breathing sounds tight and whistly"),
    ("moderate_breathing", "r", "p", "my asthma is acting up and it's hard to breathe"),

    # ---------------- overdose, conscious (Charlie) ----------------
    ("overdose", "s", "p", "{P} with an intentional overdose of pills"),
    ("overdose", "s", "p", "{P} took too many sleeping pills"),
    ("overdose", "r", "p", "{p} overdosed"),
    ("overdose", "r", "x", "{p} popped a whole bottle of {his} pills"),
    ("overdose", "r", "x", "I think {p} took something at the party, way too much"),
    ("overdose", "r", "i", "the pill bottle is empty and it was full this morning"),
    ("overdose", "s", "i", "{P} swallowed a handful of someone else's medication"),
    ("overdose", "r", "i", "{p} drank a bunch of cough syrup and took a lot of pills on purpose"),
    ("overdose", "r", "x", "{p} od'd, {he}'s awake but really drowsy"),

    # ---------------- fall / injury, possible fracture (Bravo) ----------------
    ("fracture", "s", "p", "{P} fell down the stairs"),
    ("fracture", "s", "p", "{P} fell, possible broken wrist"),
    ("fracture", "s", "p", "{P} in a minor car crash, sore neck"),
    ("fracture", "r", "p", "{p} slipped on the ice and {his} ankle looks wrong"),
    ("fracture", "r", "p", "{p} was in a car accident, {he}'s walking around but {his} arm hurts"),
    ("fracture", "r", "x", "{p} took a tumble down the stairs"),
    ("fracture", "r", "x", "{p} wiped out on {his} bike and {his} collarbone is sticking up"),
    ("fracture", "r", "i", "{p}'s leg is bent the wrong way after {he} landed on it"),
    ("fracture", "r", "i", "{p} missed the last step and now can't stand on {his} foot"),
    ("fracture", "s", "i", "{P} with a swollen, misshapen forearm after a fall"),
    ("fracture", "r", "x", "{p} got rear-ended, {his} neck and shoulder are sore"),
    ("fracture", "r", "p", "{p} fell and hurt {his} hip, can't get up"),
    ("fracture", "s", "p", "fall down stairs", "trauma"),
    ("fracture", "s", "x", "fender bender, low speed", "trauma"),
    ("fracture", "s", "p", "slip on ice", "trauma"),
    ("fracture", "s", "i", "fell off a kitchen stool onto outstretched hand", "trauma"),
    ("fracture", "s", "p", "car crash", "trauma"),

    # ---------------- bleeding, not severe (Bravo) ----------------
    ("bleeding", "s", "p", "{P} with a deep cut on the hand"),
    ("bleeding", "s", "p", "{P} with a head laceration, bleeding controlled"),
    ("bleeding", "r", "p", "{p} cut {his} arm on glass, it's bleeding but we've got a towel on it"),
    ("bleeding", "r", "x", "{p} sliced {his} thumb open on a mandoline"),
    ("bleeding", "r", "i", "{p}'s forehead split open when {he} hit the cabinet, it's oozing"),
    ("bleeding", "s", "i", "{P} with a gaping wound on the shin, pressure applied"),
    ("bleeding", "r", "x", "{p} has a nasty gash on {his} leg from the fence"),

    # ---------------- assault, conscious (Bravo) ----------------
    ("assault", "s", "p", "{P} assaulted, facial injuries"),
    ("assault", "r", "p", "{p} got beaten up outside the bar"),
    ("assault", "r", "x", "some guys jumped {p} and kicked {him} around"),
    ("assault", "r", "x", "{p} got rocked in a fight, {his} eye is swelling shut"),
    ("assault", "r", "i", "someone hit {p} with a bottle and ran off"),
    ("assault", "s", "i", "{P} punched repeatedly during a robbery"),
    ("assault", "r", "p", "{p} was attacked walking home"),

    # ---------------- unresponsive hint (needs_more_info when conscious is null) ----------------
    ("unresponsive_hint", "r", "p", "{p} isn't answering me"),
    ("unresponsive_hint", "r", "p", "I can't wake {p} up"),
    ("unresponsive_hint", "s", "p", "{P} not responding to caller"),
    ("unresponsive_hint", "r", "x", "{p} keeled over and won't talk to me"),
    ("unresponsive_hint", "r", "i", "I'm shaking {p} and {he} just won't open {his} eyes"),
    ("unresponsive_hint", "r", "x", "{p} passed out on the floor, I don't know if {he}'s coming round"),
    ("unresponsive_hint", "s", "i", "{P} slumped over, does not react to name"),
    ("fracture+unresponsive_hint", "r", "p", "{p} fell down the stairs and is not answering me"),
    ("fracture+unresponsive_hint", "r", "x", "{p} took a tumble down the stairs and won't talk to me"),
    ("fracture+unresponsive_hint", "s", "p", "{P} fell from standing, not responding"),

    # ---------------- unconscious stated in text (Delta when conscious is null) ----------------
    ("unconscious", "r", "x", "{p} is out cold on the kitchen floor"),
    ("unconscious", "s", "p", "{P} unconscious, breathing"),
    ("unconscious", "r", "i", "{p} is breathing but totally limp, nothing when I pinch {him}"),
    ("unconscious", "r", "x", "{p} got knocked out playing hockey and is still out"),
    ("fracture+unconscious", "r", "x", "{p} fell off the bunk bed and is out cold"),

    # ---------------- minor (Alpha) ----------------
    ("minor", "s", "p", "{P} with fever and sore throat"),
    ("minor", "s", "p", "{P} with lower back pain, walking"),
    ("minor", "r", "p", "{p} has a bad headache, nothing else"),
    ("minor", "r", "x", "{p} has the sniffles and a cough"),
    ("minor", "r", "i", "{p}'s ear has been hurting since yesterday"),
    ("minor", "r", "p", "{p} has a rash on {his} arm"),
    ("minor", "r", "x", "{p} got stung by a wasp, just swelling on the hand, breathing fine"),
    ("minor", "s", "i", "{P} with a stomach ache since lunch"),
    ("minor", "r", "m", "{p} fell off a chair, bumped {his} knee, walking fine"),
    ("minor", "r", "m", "{p} has a small cut, lots of blood on the shirt but it stopped"),
    ("minor", "r", "m", "{p}'s nose was bleeding a lot but it stopped now"),
    ("minor", "r", "m", "{p} banged {his} head on the cupboard, little bump, totally fine otherwise"),
    ("minor", "r", "m", "{p} burned {his} finger on the pan, small blister"),
    ("minor", "s", "m", "{P} tripped on the curb, scraped palms, no other injury"),
    ("minor", "r", "n", "{p} was choking but it came out, talking fine now"),
    ("minor", "r", "n", "{p} felt dizzy but it passed, no chest pain, breathing fine"),
    ("minor", "s", "n", "{P} with mild nausea, denies chest pain"),
    ("minor", "r", "x", "{p} threw up a couple times, probably something {he} ate"),

    # ---------------- vague (settles nothing) ----------------
    ("", "r", "p", "{p} collapsed"),
    ("", "r", "p", "something is really wrong with {p}"),
    ("", "s", "p", "{P} unwell, details unclear"),
    ("", "r", "x", "{p} just dropped in the hallway"),
    ("", "r", "i", "{p} is lying on the ground outside the store"),
    ("", "r", "x", "{p} doesn't look right at all, please hurry"),
    ("", "s", "i", "{P} found on the floor, condition unknown"),
    ("", "r", "p", "I need an ambulance for {p}"),
    ("", "r", "i", "{p} went down in the aisle"),
]

# Negation / resolved add-ons: appended to any complaint, add NO concept.
# implies: structured facts the clause asserts; the generator nulls/aligns conflicting fields.
NEGATIONS = [
    ("no chest pain", {}),
    ("denies chest pain", {}),
    ("not bleeding", {}),
    ("no bleeding", {}),
    ("no fall involved", {}),
    ("{he} didn't hit {his} head", {}),
    ("breathing fine", {"breathingNormally": True}),
    ("breathing okay", {"breathingNormally": True}),
    ("awake and talking", {"conscious": True}),
    ("{he}'s talking to me", {"conscious": True}),
    ("was choking earlier but it cleared", {}),
    ("no seizure", {}),
    ("not diabetic", {}),
]

# Concepts whose slang ("x") and indirect ("i") wordings are held out of training entirely.
HOLDOUT_STYLE_CONCEPTS = {"major_trauma", "severe_breathing", "arrest", "overdose", "diabetic",
                          "altered", "fracture", "unconscious"}

GENERIC_HURT = ["{p} is hurt", "{p} got hurt", "{P} injured", "{p} is in a lot of pain", "{P} with injuries"]
