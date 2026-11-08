import { REQUIRED_CARE_LEVEL, meetsCareLevel, type Acuity, type IncidentFacts,
  type MissingField, type ModelRequest, type ModelResponse } from "@/lib/contracts";
import { compareArrival } from "./candidates";

// Keep the demo lexicon and rule order in parity with model/rubric.py.
const lexicon = {
  arrest: [
    "not breathing", "stopped breathing", "isn't breathing", "no pulse", "cardiac arrest", "heart stopped",
    "doing cpr", "started cpr",
  ],
  choking: ["choking"],
  no_air: ["can't breathe", "cannot breathe", "no air", "can't talk", "turning blue", "blue lips"],
  severe_breathing: [
    "can't breathe", "cannot breathe", "gasping", "struggling to breathe", "turning blue", "blue lips",
    "can barely breathe",
  ],
  major_trauma: [
    "high speed", "high-speed", "highway", "rollover", "rolled over", "ejected", "hit by a car",
    "hit by a truck", "struck by a car", "thrown from", "thrown out of", "fell from the roof", "off the roof",
    "third floor", "3rd floor", "fourth floor", "three storeys", "three stories", "scaffolding",
  ],
  chest_extra: [
    "sweating", "sweaty", "nausea", "nauseous", "vomiting", "throwing up", "arm pain", "pain in his arm",
    "pain in her arm", "left arm", "jaw", "dizzy", "short of breath", "lightheaded",
  ],
  chest_pain: [
    "chest pain", "chest hurts", "pain in his chest", "pain in her chest", "pain in my chest",
    "chest pressure", "pressure in", "tight chest", "chest is tight",
  ],
  altered: [
    "confused", "disoriented", "not making sense", "acting strange", "slurring", "doesn't know where",
    "drowsy and confused",
  ],
  diabetic: ["diabetic", "diabetes", "blood sugar", "sugar is low", "sugar low", "insulin", "hypoglyc"],
  seizure: ["seizure", "fitting", "convulsing", "convulsion"],
  moderate_breathing: [
    "short of breath", "trouble breathing", "wheezing", "asthma", "hard to breathe", "breathing fast",
    "can't catch",
  ],
  overdose: ["overdose", "too many pills", "took a bunch of pills", "overdosed", "od'd"],
  fracture: [
    "fell", "fall", "broken", "broke", "fracture", "twisted", "deformed", "can't put weight", "slipped",
    "tripped", "crash", "collision", "car accident", "fender bender", "rear-ended",
  ],
  bleeding: ["bleeding", "cut", "laceration", "gash"],
  assault: ["assault", "beaten", "punched", "attacked", "got in a fight", "stabbed"],
  unresponsive_hint: [
    "not answering", "not responding", "unresponsive", "won't wake", "can't wake", "won't respond",
    "not waking up", "passed out",
  ],
  unconscious: ["unconscious", "out cold", "knocked out"],
  minor: [
    "sore throat", "fever", "rash", "earache", "back pain", "stubbed", "splinter", "nosebleed", "nose bleed",
    "cold", "flu", "headache", "stomach ache", "sprain", "bee sting", "minor burn", "small burn", "toothache",
    "cough", "bruise", "scrape",
  ],
} as const;

type Signal = keyof typeof lexicon;
const escapePattern = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = (Object.keys(lexicon) as Signal[]).map((key) => [
  key, new RegExp(`(?<![a-z])(?:${lexicon[key].map(escapePattern).join("|")})(?:s|es|ed|d|ing|en)?(?![a-z])`),
] as const);

function assess(facts: IncidentFacts):
  | { acuity: Acuity; evidence: string }
  | { acuity: null; missing: MissingField[] } {
  const text = [facts.chiefComplaint, facts.traumaMechanism, facts.notes].filter(Boolean).join(" ").toLowerCase();
  const signals = new Set(patterns.filter(([, pattern]) => pattern.test(text)).map(([key]) => key));
  const has = (key: Signal) => signals.has(key);
  const conscious = facts.conscious ?? (has("unconscious") ? false : null);
  const breathing = facts.breathingNormally;
  const chest = facts.chestPain === true || has("chest_pain");
  const chokingNoAir = has("choking") && has("no_air");
  const settling = [...signals].some((key) => key !== "chest_extra" && key !== "no_air" && key !== "unresponsive_hint");
  if (conscious === null && has("unresponsive_hint") && !has("arrest") && !chokingNoAir) {
    return { acuity: null, missing: breathing === null ? ["conscious", "breathingNormally"] : ["conscious"] };
  }
  if (conscious === null && breathing === null && !settling && facts.severeBleeding !== true && facts.chestPain !== true) {
    const missing: MissingField[] = ["conscious", "breathingNormally"];
    if (!facts.chiefComplaint) missing.unshift("chiefComplaint");
    return { acuity: null, missing };
  }

  if (breathing === false && conscious === false) return { acuity: "Echo", evidence: "Unconscious and not breathing normally" };
  if (has("arrest")) return { acuity: "Echo", evidence: "Complaint describes no breathing, no pulse or CPR" };
  if (chokingNoAir) return { acuity: "Echo", evidence: "Choking with no air moving" };
  if (conscious === false) return { acuity: "Delta", evidence: "Patient is reported unconscious" };
  if (has("severe_breathing") || has("choking")) return { acuity: "Delta", evidence: "Severe breathing difficulty or choking described" };
  if (facts.severeBleeding === true) return { acuity: "Delta", evidence: "Severe bleeding reported" };
  if (chest && facts.patientAge !== null && facts.patientAge >= 35 && (has("chest_extra") || breathing === false)) {
    return { acuity: "Delta", evidence: `Chest pain at age ${facts.patientAge} with an additional symptom` };
  }
  if (has("major_trauma")) return { acuity: "Delta", evidence: "Major trauma mechanism described" };
  if (chest) return { acuity: "Charlie", evidence: "Chest pain or pressure reported" };
  if (has("altered")) return { acuity: "Charlie", evidence: "Altered mental status described" };
  if (has("diabetic")) return { acuity: "Charlie", evidence: "Diabetic or blood-sugar problem described" };
  if (has("seizure")) return { acuity: "Charlie", evidence: "Seizure described" };
  if (has("moderate_breathing") || breathing === false) return { acuity: "Charlie", evidence: "Abnormal breathing reported" };
  if (has("overdose")) return { acuity: "Charlie", evidence: "Possible overdose described" };
  if (has("fracture")) return { acuity: "Bravo", evidence: "Fall or injury with possible fracture" };
  if (has("bleeding")) return { acuity: "Bravo", evidence: "Bleeding wound reported" };
  if (has("assault")) return { acuity: "Bravo", evidence: "Assault with injury described" };
  return { acuity: "Alpha", evidence: "No higher-acuity trigger in the reported facts" };
}

export function fallbackResponse(request: ModelRequest): ModelResponse {
  const assessment = assess(request.incident.facts);
  if (assessment.acuity === null) {
    return {
      status: "needs_more_info", acuity: null, missingFields: assessment.missing,
      reason: assessment.missing.includes("breathingNormally")
        ? "Confirm whether the patient is conscious and breathing normally."
        : "Confirm whether the patient is conscious.",
    };
  }

  const { acuity, evidence } = assessment;
  const required = REQUIRED_CARE_LEVEL[acuity];
  const candidates = [...request.candidates].sort(compareArrival).map((candidate) => {
    const crewSuitable = meetsCareLevel(candidate.careLevel, required);
    const arrival = candidate.arrivalInSeconds === null
      ? "Arrival estimate unavailable"
      : `Estimated arrival in ${Math.ceil(candidate.arrivalInSeconds / 60)} min`;
    const care = crewSuitable ? `${candidate.careLevel} crew meets ${required} requirement`
      : `${candidate.careLevel} crew falls below ${required} requirement`;
    return { ambulanceId: candidate.ambulanceId, crewSuitable, reason: `${care}. ${arrival}.` };
  });
  return {
    status: "ready",
    acuityReason: `${evidence}, so ${acuity}. ${required} required.`,
    acuity,
    summary: request.incident.facts.chiefComplaint?.trim().slice(0, 200) || "Incident assessed from reported facts.",
    recommendedAmbulanceId: (candidates.find((c) => c.crewSuitable) ?? candidates[0]).ambulanceId,
    candidates,
  };
}

export function mockResponse(request: ModelRequest): ModelResponse {
  return fallbackResponse(request);
}
