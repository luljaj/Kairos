import { z } from "zod";
import {
  Acuity,
  AmbulanceId,
  CallId,
  CareLevel,
  CrewId,
  HospitalId,
  IsoTime,
  LatLng,
  RecommendationId,
  Seconds,
  TaskId,
} from "./common";

// ---------------------------------------------------------------------------
// Incident facts — DRAFT, friend to confirm (see plan/01-contracts.md).
// null = caller said unknown / not yet known.
// ---------------------------------------------------------------------------

export const IncidentFacts = z.strictObject({
  chiefComplaint: z.string().nullable(),
  patientCount: z.int().min(1).nullable(),
  patientAge: z.int().min(0).max(120).nullable(),
  patientSex: z.enum(["male", "female", "other"]).nullable(),
  conscious: z.boolean().nullable(),
  breathingNormally: z.boolean().nullable(),
  severeBleeding: z.boolean().nullable(),
  chestPain: z.boolean().nullable(),
  traumaMechanism: z.string().nullable(),
  hazards: z.string().nullable(),
  callerRelation: z.enum(["self", "family", "bystander", "other"]).nullable(),
  notes: z.string().nullable(),
});
export type IncidentFacts = z.infer<typeof IncidentFacts>;
export type FactKey = keyof IncidentFacts;
export const FACT_KEYS = Object.keys(IncidentFacts.shape) as FactKey[];

export const EMPTY_FACTS: IncidentFacts = Object.fromEntries(
  FACT_KEYS.map((k) => [k, null]),
) as IncidentFacts;

/** Fields a recommendation can ask for (same list the model uses; no `notes`). */
export const MissingField = z.enum([
  "location",
  "chiefComplaint",
  "patientCount",
  "patientAge",
  "patientSex",
  "conscious",
  "breathingNormally",
  "severeBleeding",
  "chestPain",
  "traumaMechanism",
  "hazards",
  "callerRelation",
]);
export type MissingField = z.infer<typeof MissingField>;

// ---------------------------------------------------------------------------
// Call (incident)
// ---------------------------------------------------------------------------

export const LocationConfidence = z.enum(["confirmed", "approximate"]).nullable();

export const CallLocation = z.strictObject({
  text: z.string().nullable(),
  coords: LatLng.nullable(),
  confidence: LocationConfidence,
});
export type CallLocation = z.infer<typeof CallLocation>;

export const AcuitySource = z.enum(["model", "fallback", "dispatcher"]);
export type AcuitySource = z.infer<typeof AcuitySource>;

export const AcuityAssignment = z.strictObject({
  value: Acuity,
  source: AcuitySource,
  setAt: IsoTime,
});
export type AcuityAssignment = z.infer<typeof AcuityAssignment>;

export const TranscriptEntry = z.strictObject({
  role: z.enum(["agent", "caller"]),
  text: z.string(),
  at: IsoTime,
});

export const CallStatus = z.enum(["intake", "awaiting_decision", "assigned", "closed"]);
export type CallStatus = z.infer<typeof CallStatus>;

export const Call = z.strictObject({
  id: CallId,
  revision: z.int().min(0),
  conversationId: z.string().nullable(),
  callerNumber: z.string().nullable(),
  status: CallStatus,
  location: CallLocation,
  facts: IncidentFacts,
  /** Bumps only when a fact or location.coords changes value. */
  factsRevision: z.int().min(0),
  summary: z.string().nullable(),
  acuity: AcuityAssignment.nullable(),
  recommendationSetId: RecommendationId.nullable(),
  taskId: TaskId.nullable(),
  transcript: z.array(TranscriptEntry),
  createdAt: IsoTime,
  updatedAt: IsoTime,
});
export type Call = z.infer<typeof Call>;

// ---------------------------------------------------------------------------
// Crew + ambulances
// ---------------------------------------------------------------------------

/** App labels, not official agency codes. */
export const Qualification = z.enum([
  "nys_emt",
  "nys_aemt",
  "nys_paramedic",
  "hf_driver_cleared",
  "hf_crew_chief_cleared",
  "hf_als_cleared",
]);
export type Qualification = z.infer<typeof Qualification>;

export const CrewRole = z.enum(["driver", "crew_chief", "attendant"]);
export type CrewRole = z.infer<typeof CrewRole>;

export const CrewMember = z.strictObject({
  id: CrewId,
  name: z.string().min(1),
  role: CrewRole,
  qualifications: z.array(Qualification),
  monthsOfService: z.int().min(0),
});
export type CrewMember = z.infer<typeof CrewMember>;

export const AmbulanceStatus = z.enum(["available", "busy", "out_of_service"]);
export type AmbulanceStatus = z.infer<typeof AmbulanceStatus>;

export const Ambulance = z.strictObject({
  id: AmbulanceId,
  revision: z.int().min(0),
  name: z.string().min(1),
  position: LatLng,
  status: AmbulanceStatus,
  crewIds: z.array(CrewId),
  activeTaskId: TaskId.nullable(),
  /** Queue order lives here only. */
  queuedTaskIds: z.array(TaskId),
  homeStation: LatLng,
});
export type Ambulance = z.infer<typeof Ambulance>;

export const Hospital = z.strictObject({
  id: HospitalId,
  name: z.string().min(1),
  coords: LatLng,
});
export type Hospital = z.infer<typeof Hospital>;

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

export const TaskStatus = z.enum(["queued", "active", "completed", "cancelled"]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const TaskPhase = z.enum(["en_route", "on_scene", "transporting", "completed"]);
export type TaskPhase = z.infer<typeof TaskPhase>;

export const Route = z.strictObject({
  /** GeoJSON order: [lng, lat]. */
  geometry: z.array(z.tuple([z.number(), z.number()])),
  durationSeconds: Seconds,
  distanceMeters: z.number().min(0),
  /** true when routing failed and the straight-line fallback was used. */
  estimated: z.boolean(),
});
export type Route = z.infer<typeof Route>;

export const TaskOverride = z.strictObject({
  reason: z.enum(["dispatcher_choice", "capability_mismatch_confirmed"]),
  note: z.string().nullable(),
});

export const Task = z.strictObject({
  id: TaskId,
  revision: z.int().min(0),
  callId: CallId,
  ambulanceId: AmbulanceId,
  status: TaskStatus,
  /** null while queued */
  phase: TaskPhase.nullable(),
  acuityAtAcceptance: Acuity.nullable(),
  hospital: z.strictObject({ name: z.string(), coords: LatLng }).nullable(),
  route: Route.nullable(),
  phaseEndsAt: IsoTime.nullable(),
  /** Arrival at scene. */
  etaAt: IsoTime.nullable(),
  acceptedFromRecommendationId: RecommendationId.nullable(),
  override: TaskOverride.nullable(),
  createdAt: IsoTime,
  updatedAt: IsoTime,
});
export type Task = z.infer<typeof Task>;

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export const Candidate = z.strictObject({
  ambulanceId: AmbulanceId,
  // backend facts
  availableInSeconds: Seconds.nullable(),
  travelSeconds: Seconds.nullable(),
  arrivalInSeconds: Seconds.nullable(),
  careLevel: CareLevel,
  selectable: z.boolean(),
  unavailableReason: z.string().nullable(),
  capabilityMismatch: z.boolean(),
  // model judgement
  crewSuitable: z.boolean().nullable(),
  reason: z.string().nullable(),
});
export type Candidate = z.infer<typeof Candidate>;

export const RecommendationStatus = z.enum(["ready", "needs_more_info", "error", "stale"]);

export const RecommendationSet = z.strictObject({
  id: RecommendationId,
  callId: CallId,
  factsRevision: z.int().min(0),
  fleetRevision: z.int().min(0),
  createdAt: IsoTime,
  source: z.enum(["model", "fallback"]),
  /** e.g. "qwen3-4b-base" or adapter name */
  modelId: z.string().nullable(),
  status: RecommendationStatus,
  /** Model (or fallback) explanation of the acuity; shown under the acuity chip. */
  acuityReason: z.string().nullable(),
  acuity: Acuity.nullable(),
  summary: z.string().nullable(),
  missingFields: z.array(MissingField),
  recommendedAmbulanceId: AmbulanceId.nullable(),
  /** Backend order: eligible by arrival, then mismatched, then unavailable. */
  candidates: z.array(Candidate),
  latencyMs: z.number().min(0).nullable(),
});
export type RecommendationSet = z.infer<typeof RecommendationSet>;

// ---------------------------------------------------------------------------
// Whole server state (what /api/events streams)
// ---------------------------------------------------------------------------

export const DispatchState = z.strictObject({
  revision: z.int().min(0),
  /** Bumped on any fleet-affecting change; recommendation sets record it. */
  fleetRevision: z.int().min(0),
  simClock: IsoTime,
  calls: z.record(z.string(), Call),
  ambulances: z.record(z.string(), Ambulance),
  crew: z.record(z.string(), CrewMember),
  tasks: z.record(z.string(), Task),
  recommendations: z.record(z.string(), RecommendationSet),
  hospitals: z.array(Hospital),
});
export type DispatchState = z.infer<typeof DispatchState>;
