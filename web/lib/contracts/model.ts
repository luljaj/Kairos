/**
 * Backend <-> model contract. Mirrors model/schemas/model-request.json and
 * model-response.json (hand-written there; `pnpm contracts:check` verifies the
 * examples in model/schemas/examples parse here, and `pnpm contracts:export`
 * writes this side's JSON Schema for diffing).
 */
import { z } from "zod";
import { Acuity, CareLevel, Seconds } from "./common";
import { CrewRole, IncidentFacts, LocationConfidence, MissingField, Qualification } from "./entities";

export const ModelCandidate = z.strictObject({
  ambulanceId: z.string().min(1),
  careLevel: CareLevel,
  crew: z
    .array(
      z.strictObject({
        role: CrewRole,
        qualifications: z.array(Qualification),
        monthsOfService: z.int().min(0),
      }),
    )
    .min(1),
  availableInSeconds: Seconds.nullable(),
  travelSeconds: Seconds.nullable(),
  arrivalInSeconds: Seconds.nullable(),
});
export type ModelCandidate = z.infer<typeof ModelCandidate>;

/** No transcripts, names or coordinates; only selectable candidates (1–3). */
export const ModelRequest = z.strictObject({
  requestId: z.string().min(1),
  incident: z.strictObject({
    location: z.strictObject({
      text: z.string().nullable(),
      confidence: LocationConfidence,
    }),
    facts: IncidentFacts,
  }),
  candidates: z.array(ModelCandidate).min(1).max(3),
});
export type ModelRequest = z.infer<typeof ModelRequest>;

export const ModelResponseReady = z.strictObject({
  status: z.literal("ready"),
  /**
   * Why this acuity: the deciding fact(s) and rubric row, ending with the level
   * and required care, e.g. "Unconscious after a fall (conscious = false), so
   * Delta; ALS required." Must come BEFORE `acuity` (guided decoding follows
   * property order, so the model commits to the evidence first). See
   * model/CONTRACT_CHANGES.md.
   */
  acuityReason: z.string().min(1).max(200),
  acuity: Acuity,
  summary: z.string().min(1).max(200),
  recommendedAmbulanceId: z.string().min(1),
  candidates: z
    .array(
      z.strictObject({
        ambulanceId: z.string().min(1),
        crewSuitable: z.boolean(),
        reason: z.string().min(1).max(160),
      }),
    )
    .min(1)
    .max(3),
});

export const ModelResponseNeedsMoreInfo = z.strictObject({
  status: z.literal("needs_more_info"),
  acuity: z.null(),
  missingFields: z.array(MissingField).min(1),
  reason: z.string().min(1).max(200),
});

export const ModelResponse = z.discriminatedUnion("status", [
  ModelResponseReady,
  ModelResponseNeedsMoreInfo,
]);
export type ModelResponse = z.infer<typeof ModelResponse>;

/**
 * Semantic checks the JSON Schema can't express. Returns a list of problems;
 * empty means valid. Invalid output -> fallback result.
 */
export function checkModelResponse(req: ModelRequest, res: ModelResponse): string[] {
  if (res.status === "needs_more_info") {
    return new Set(res.missingFields).size === res.missingFields.length
      ? []
      : ["missingFields has duplicates"];
  }
  const problems: string[] = [];
  const sent = req.candidates.map((c) => c.ambulanceId);
  const got = res.candidates.map((c) => c.ambulanceId);
  for (const id of got) if (!sent.includes(id)) problems.push(`unknown ambulanceId ${id}`);
  for (const id of sent) {
    const n = got.filter((g) => g === id).length;
    if (n !== 1) problems.push(`ambulanceId ${id} appears ${n} times`);
  }
  if (!sent.includes(res.recommendedAmbulanceId)) {
    problems.push(`recommendedAmbulanceId ${res.recommendedAmbulanceId} not among candidates`);
  }
  const named = levelsNamed(res.acuityReason);
  if (named.length !== 1 || named[0] !== res.acuity) {
    problems.push(`acuityReason names [${named.join(", ")}] but acuity is ${res.acuity}`);
  }
  return problems;
}

const LEVELS = Acuity.options;

/** Acuity levels mentioned in a reason (whole words). The reason must name exactly the chosen one. */
export function levelsNamed(text: string): Acuity[] {
  return LEVELS.filter((l) => new RegExp(`\\b${l}\\b`).test(text));
}
