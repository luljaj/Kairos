import { z } from "zod";

/** UTC ISO-8601 timestamp. */
export const IsoTime = z.iso.datetime();
export type IsoTime = z.infer<typeof IsoTime>;

export const LatLng = z.strictObject({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof LatLng>;

/** Durations are always seconds; unknown is null, never 0. */
export const Seconds = z.number().min(0);

/**
 * Suggested acuity (MPDS-style, unofficial). Styled after MPDS determinant
 * levels; this demo does not implement the licensed IAED protocol. Omega unused.
 */
export const Acuity = z.enum(["Alpha", "Bravo", "Charlie", "Delta", "Echo"]);
export type Acuity = z.infer<typeof Acuity>;

export const CareLevel = z.enum(["ALS", "BLS"]);
export type CareLevel = z.infer<typeof CareLevel>;

export const REQUIRED_CARE_LEVEL: Record<Acuity, CareLevel> = {
  Echo: "ALS",
  Delta: "ALS",
  Charlie: "ALS",
  Bravo: "BLS",
  Alpha: "BLS",
};

/** True if `have` can do work that requires `need` (ALS covers BLS). */
export function meetsCareLevel(have: CareLevel, need: CareLevel): boolean {
  return have === "ALS" || need === "BLS";
}

export const ACUITY_DISCLAIMER =
  "Acuity letters are styled after the MPDS determinant levels familiar to local dispatchers. " +
  "This demo does not implement the licensed IAED protocol; the mapping is a simplified demo rubric.";

/** Stable string IDs with a type prefix. */
const prefixed = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}-[A-Za-z0-9_-]+$`), `expected ${prefix}-… id`);

export const CallId = prefixed("call");
export const AmbulanceId = prefixed("amb");
export const CrewId = prefixed("crew");
export const TaskId = prefixed("task");
export const RecommendationId = prefixed("rec");
export const HospitalId = prefixed("hosp");
