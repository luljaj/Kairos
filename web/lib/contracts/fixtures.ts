/** Shapes of the JSON files in web/fixtures/. */
import { z } from "zod";
import { Acuity, AmbulanceId } from "./common";
import { Ambulance, CallLocation, CrewMember, Hospital, IncidentFacts } from "./entities";

export const FleetFixture = z.object({
  $comment: z.string().optional(),
  ambulances: z.array(Ambulance).length(3),
  crew: z.array(CrewMember),
  hospitals: z.array(Hospital).min(1),
});
export type FleetFixture = z.infer<typeof FleetFixture>;

/** A scripted caller: timed update-incident payloads replayed through the voice code path. */
export const ScenarioFixture = z.object({
  $comment: z.string().optional(),
  id: z.string().min(1),
  title: z.string(),
  callerNumber: z.string().nullable(),
  /** Coords stand in for geocoding until that exists. */
  location: CallLocation,
  steps: z
    .array(
      z.object({
        atSeconds: z.number().min(0),
        locationText: z.string().optional(),
        facts: IncidentFacts.partial(),
        transcript: z
          .array(z.object({ role: z.enum(["agent", "caller"]), text: z.string() }))
          .optional(),
      }),
    )
    .min(1),
  expected: z.object({ acuity: Acuity.nullable(), recommendedAmbulanceId: AmbulanceId.nullable() }),
});
export type ScenarioFixture = z.infer<typeof ScenarioFixture>;
