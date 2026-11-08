/** ElevenLabs server-tool payloads. Both routes require header `x-tool-secret`. */
import { z } from "zod";
import { IncidentFacts, MissingField } from "./entities";

export const TOOL_SECRET_HEADER = "x-tool-secret";

/**
 * Partial update. Omitted key = not discussed (left alone);
 * `null` = caller said unknown (stored as null).
 */
export const UpdateIncidentBody = z.object({
  conversationId: z.string().min(1),
  callerNumber: z.string().nullish(),
  locationText: z.string().nullish(),
  facts: IncidentFacts.partial().optional(),
  /** Send true with the final intake update to request an assessment once. */
  intakeComplete: z.boolean().optional(),
});
export type UpdateIncidentBody = z.infer<typeof UpdateIncidentBody>;

export const UpdateIncidentResult = z.object({ ok: z.literal(true), callId: z.string() });

export const GetAssignmentBody = z.object({ conversationId: z.string().min(1) });

export const GetAssignmentResult = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("pending"),
    sayHint: z.string(),
    /**
     * From the latest recommendation when it is `needs_more_info` (else empty):
     * what the agent should ask next, most important first.
     */
    missingFields: z.array(MissingField),
  }),
  z.object({
    state: z.literal("assigned"),
    unitName: z.string(),
    /** null until the route/ETA is computed. */
    etaMinutes: z.int().min(0).nullable(),
    queued: z.boolean(),
  }),
]);
export type GetAssignmentResult = z.infer<typeof GetAssignmentResult>;
