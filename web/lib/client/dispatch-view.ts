import type {
  Ambulance,
  Call,
  Candidate,
  CrewRole,
  DispatchState,
  Qualification,
  Task,
} from "@/lib/contracts";

export const crewRoleLabels: Record<CrewRole, string> = {
  driver: "Driver",
  crew_chief: "Crew Chief",
  attendant: "Attendant",
};

export const qualificationLabels: Record<Qualification, string> = {
  nys_emt: "NYS EMT",
  nys_aemt: "NYS AEMT",
  nys_paramedic: "NYS Paramedic",
  hf_driver_cleared: "HF Driver Cleared",
  hf_crew_chief_cleared: "HF Crew Chief Cleared",
  hf_als_cleared: "HF ALS Cleared",
};

export const durationLabel = (seconds: number | null | undefined): string =>
  seconds == null || !Number.isFinite(seconds)
    ? "Unknown"
    : `${Math.ceil(Math.max(0, seconds) / 60)} min`;

export const callTitle = (call: Call) =>
  call.facts.chiefComplaint || "Incident intake";
export const fieldLabel = (key: string) =>
  key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
export const taskArrival = (task: Task, state: DispatchState) =>
  task.etaAt
    ? Math.max(0, (Date.parse(task.etaAt) - Date.parse(state.simClock)) / 1000)
    : null;

export function unitStatus(unit: Ambulance, state: DispatchState): string {
  if (unit.status === "out_of_service") return "Out of service";
  const task = unit.activeTaskId ? state.tasks[unit.activeTaskId] : null;
  return task?.phase
    ? fieldLabel(task.phase.replaceAll("_", " "))
    : unit.returnTrip ? "Returning to squadroom" : fieldLabel(unit.status);
}

export function selectedCall(
  state: DispatchState | null,
  id: string | null,
): Call | null {
  if (!state) return null;
  return (
    (id ? state.calls[id] : null) ??
    Object.values(state.calls).find(
      (call) => call.status !== "closed" && !call.taskId,
    ) ??
    Object.values(state.calls).find((call) => call.status !== "closed") ??
    null
  );
}

export function selectedCandidate(
  candidates: Candidate[],
  id: string | null,
): Candidate | null {
  return (
    candidates.find((candidate) => candidate.ambulanceId === id) ??
    candidates[0] ??
    null
  );
}
