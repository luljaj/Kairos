/** Dispatcher commands: POST /api/commands with `{ commandId, type, ...payload }`. */
import { z } from "zod";
import { Acuity, AmbulanceId, CallId, RecommendationId, TaskId } from "./common";
import { CallLocation, IncidentFacts } from "./entities";

const base = { commandId: z.uuid() };

export const Command = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("accept_recommendation"),
    recommendationSetId: RecommendationId,
    ambulanceId: AmbulanceId,
    confirmMismatch: z.boolean().optional(),
  }),
  z.object({
    ...base,
    type: z.literal("manual_assign"),
    callId: CallId,
    ambulanceId: AmbulanceId,
    confirmMismatch: z.boolean().optional(),
  }),
  z.object({ ...base, type: z.literal("override_acuity"), callId: CallId, acuity: Acuity }),
  z.object({
    ...base,
    type: z.literal("edit_incident"),
    callId: CallId,
    location: CallLocation.partial().optional(),
    facts: IncidentFacts.partial().optional(),
  }),
  z.object({ ...base, type: z.literal("request_recommendation"), callId: CallId }),
  z.object({ ...base, type: z.literal("cancel_task"), taskId: TaskId }),
  z.object({
    ...base,
    type: z.literal("move_queued_task"),
    taskId: TaskId,
    toIndex: z.int().min(0),
  }),
  z.object({ ...base, type: z.literal("advance_phase"), taskId: TaskId }),
  z.object({
    ...base,
    type: z.literal("create_manual_call"),
    location: CallLocation,
    facts: IncidentFacts.partial(),
  }),
  z.object({ ...base, type: z.literal("reset_demo") }),
]);
export type Command = z.infer<typeof Command>;
export type CommandType = Command["type"];

export const CommandErrorCode = z.enum([
  "invalid",
  "not_found",
  "stale",
  "conflict",
  "not_selectable",
  "mismatch_unconfirmed",
  "not_implemented",
]);
export type CommandErrorCode = z.infer<typeof CommandErrorCode>;

export const CommandResult = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    revision: z.int(),
    /** Set when an accept/assign landed in a busy unit's queue. */
    queued: z.boolean().optional(),
    /** Id of the entity the command created, if any. */
    createdId: z.string().optional(),
  }),
  z.object({ ok: z.literal(false), error: CommandErrorCode, message: z.string() }),
]);
export type CommandResult = z.infer<typeof CommandResult>;
