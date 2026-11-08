import { DispatchState, type Task } from "@/lib/contracts";
import { fleetDemoScenario } from "@/lib/demo/scenarios";
import { initialState } from "./fixtures";
import { createCall } from "./incidents";
import { nearestHospital } from "./eta";
import { newId } from "./store";

/** Build a complete replacement snapshot before publishing it to the simulation. */
export function buildFleetDemo(id: string, now = new Date()): DispatchState | null {
  if (!fleetDemoScenario(id)) return null;
  const state = initialState(now);
  const positions = [
    { lat: 42.0995, lng: -75.9165 },
    { lat: 42.1105, lng: -75.9480 },
    { lat: 42.0790, lng: -75.9850 },
  ];
  Object.values(state.ambulances).forEach((unit, i) => {
    unit.position = { ...positions[i] };
  });
  if (id === "fleet-spread") {
    // Available away from base means returning from a hospital, never parked at random.
    for (const [unitId, hospitalId] of [
      ["amb-1", "hosp-lourdes"], ["amb-2", "hosp-wilson"],
    ]) {
      const unit = state.ambulances[unitId];
      unit.position = { ...state.hospitals.find((hospital) => hospital.id === hospitalId)!.coords };
      unit.returnTrip = { route: null, endsAt: null };
    }
  } else if (id === "fleet-mixed") {
    const unit = state.ambulances["amb-1"];
    unit.position = { ...unit.homeStation };
  }
  if (id === "fleet-experience") {
    state.ambulances["amb-1"].position = { ...state.ambulances["amb-1"].homeStation };
    // Two crews returning from the same hospital: Medic 3 is a little farther
    // along the journey home, so takes slightly longer to divert to Riverside.
    state.ambulances["amb-2"].position = { ...state.hospitals.find((h) => h.id === "hosp-lourdes")!.coords };
    state.ambulances["amb-3"].position = { lat: 42.0915, lng: -75.9375 };
    for (const id of ["amb-2", "amb-3"]) state.ambulances[id].returnTrip = { route: null, endsAt: null };
    return DispatchState.parse(state);
  }
  // A substantial remaining transport gives the presenter time to explain queuing.
  if (id === "fleet-mixed" || id === "fleet-busy") {
    state.ambulances["amb-2"].position = { lat: 42.078, lng: -75.987 };
  }
  if (id === "fleet-busy") state.ambulances["amb-3"].position = { lat: 42.095, lng: -75.9245 };

  function job(unitId: string, phase: "en_route" | "on_scene" | "transporting" | "queued", label: string) {
    const unit = state.ambulances[unitId];
    const coords = phase === "on_scene" ? { ...unit.position }
      : { lat: unit.position.lat - 0.004, lng: unit.position.lng + 0.006 };
    const call = createCall(state, {
      now: state.simClock,
      location: { text: `${label} (fictional demo)`, coords, confidence: "confirmed" },
      facts: {
        chiefComplaint: "Fall with wrist injury", patientCount: 1, patientAge: 58,
        conscious: true, breathingNormally: true, severeBleeding: false,
        traumaMechanism: "fall from standing",
      },
    });
    call.acuity = { value: "Bravo", source: "dispatcher", setAt: state.simClock };
    call.status = "assigned";
    call.summary = `Demo incident: ${label}`;
    const queued = phase === "queued";
    const task: Task = {
      id: newId("task"), revision: 0, callId: call.id, ambulanceId: unit.id,
      status: queued ? "queued" : "active", phase: queued ? null : phase,
      acuityAtAcceptance: "Bravo", hospital: nearestHospital(state, coords),
      route: null,
      phaseEndsAt: phase === "on_scene" ? new Date(now.getTime() + 480_000).toISOString() : null,
      etaAt: null, acceptedFromRecommendationId: null, override: null,
      createdAt: state.simClock, updatedAt: state.simClock,
    };
    call.taskId = task.id;
    state.tasks[task.id] = task;
    if (queued) unit.queuedTaskIds.push(task.id);
    else { unit.activeTaskId = task.id; unit.status = "busy"; }
  }

  job("amb-3", "on_scene", id === "fleet-busy" ? "Riverside kitchen fall" : "Vestal kitchen fall");
  if (id !== "fleet-spread") job("amb-2", "transporting", "Vestal patient transport");
  if (id === "fleet-busy") {
    job("amb-1", "en_route", "Downtown fall");
    job("amb-3", "queued", "Riverside follow-up incident");
  }
  // Fail before replacing live state if a setup ever violates the contracts.
  return DispatchState.parse(state);
}
