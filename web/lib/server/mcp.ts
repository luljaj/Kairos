/**
 * MCP server for the voice agent. Exposes the same two tools as the webhook routes
 * (`/api/voice/tools/*`) and runs the same code path, so the dashboard can't tell them apart.
 *
 * Facts are flat top-level arguments (not a nested `facts` object): LLM tool calls fill
 * flat schemas more reliably. Field descriptions are what the agent's LLM reads; they
 * follow the field rules in plan/03-voice-intake.md.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FACT_KEYS, type IncidentFacts } from "@/lib/contracts";
import { getAssignment, ingestIncident } from "./voice";

const conversationId = z
  .string()
  .min(1)
  .describe("The conversation ID from your instructions ({{system__conversation_id}}). Same value on every call.");

// Omit a field when the caller hasn't said it. `null` retracts something said earlier.
const factArgs = {
  chiefComplaint: z
    .string()
    .nullish()
    .describe(
      "What happened, in the caller's own words, max ~20 words. Never use medical terms or abbreviations. " +
        "Replaces the previous value: when a new symptom comes up, resend the whole complaint with the new words added.",
    ),
  conscious: z
    .boolean()
    .nullish()
    .describe(
      "true only if the caller says the patient is awake, talking or responding. false only if the caller confirms " +
        "they don't respond to voice or touch. 'Not answering me' alone is NOT false; ask first. Caller is the patient: true.",
    ),
  breathingNormally: z
    .boolean()
    .nullish()
    .describe(
      "true if breathing normally. false for any abnormal breathing (struggling, gasping, wheezing, very fast, not breathing). " +
        "Also put the caller's words for how they breathe in chiefComplaint.",
    ),
  severeBleeding: z
    .boolean()
    .nullish()
    .describe("true only for heavy bleeding that won't stop, spurting, or soaking through. Minor or controlled: false."),
  chestPain: z.boolean().nullish().describe("true for any chest pain, pressure or tightness; false if the caller denies it."),
  patientAge: z
    .int()
    .min(0)
    .max(120)
    .nullish()
    .describe("Age in years. 'About 70' -> 70. 'Elderly' or 'a teenager' -> leave out. Ask whenever chest pain comes up."),
  patientSex: z.enum(["male", "female", "other"]).nullish().describe("Only if stated or clear ('my dad', 'my wife')."),
  patientCount: z.int().min(1).nullish().describe("Number of patients, only if asked or stated."),
  traumaMechanism: z
    .string()
    .nullish()
    .describe(
      "How the injury happened, with specifics: 'fell from the roof', 'fell from standing', 'rollover on the highway', " +
        "'hit by a car', 'assaulted'. Write 'ejected' if someone was thrown out of a vehicle.",
    ),
  hazards: z.string().nullish().describe("Scene dangers only: fire or smoke, traffic, violence, dog, ice."),
  callerRelation: z
    .enum(["self", "family", "bystander", "other"])
    .nullish()
    .describe("Caller's relation to the patient. Roommate, coworker, neighbour, carer -> other."),
  notes: z
    .string()
    .nullish()
    .describe("Practical extras: door code, floor, blood thinners, pregnant, language. Symptoms go in chiefComplaint."),
} satisfies Record<keyof IncidentFacts, z.ZodType>;

export function createVoiceMcpServer(): McpServer {
  const server = new McpServer({ name: "kairos-voice", version: "0.1.0" });

  server.registerTool(
    "update_incident",
    {
      title: "Update incident",
      description:
        "Send what the caller just told you to the dispatch dashboard. Call it as soon as you have an address, and again " +
        "after every answer that adds or changes a fact. Send only fields the caller actually stated; leave out anything unknown. " +
        "The dispatcher's proposal is only built once you send intakeComplete: true.",
      inputSchema: {
        conversationId,
        callerNumber: z.string().nullish().describe("Caller ID ({{system__caller_id}}), if available."),
        locationText: z.string().nullish().describe("The address or location, as you read it back to the caller."),
        intakeComplete: z
          .boolean()
          .optional()
          .describe(
            "Send true with the update that finishes the core questions (location, what happened, awake, breathing, " +
              "plus any follow-ups). Leave it out on earlier updates. Updates after it still count.",
          ),
        ...factArgs,
      },
      annotations: { idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      const facts: Partial<IncidentFacts> = {};
      for (const key of FACT_KEYS) {
        if (args[key] !== undefined) (facts as Record<string, unknown>)[key] = args[key];
      }
      const body = {
        conversationId: args.conversationId,
        callerNumber: args.callerNumber,
        locationText: args.locationText,
        intakeComplete: args.intakeComplete,
        facts,
      };
      console.log("[mcp] update_incident", JSON.stringify(body));
      const callId = await ingestIncident(body);
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, callId }) }] };
    },
  );

  server.registerTool(
    "get_assignment",
    {
      title: "Get assignment",
      description:
        "Check whether the dispatcher has assigned an ambulance. Returns state 'pending' (with sayHint and missingFields to " +
        "ask about first) or 'assigned' (unitName, etaMinutes which may be null, and queued). Call after the core questions, " +
        "then every 10-15 seconds while pending. Never promise a time until it returns 'assigned'.",
      inputSchema: { conversationId },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ conversationId }) => {
      const result = getAssignment(conversationId);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    },
  );

  return server;
}
