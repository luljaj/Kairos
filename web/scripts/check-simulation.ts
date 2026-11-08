import assert from "node:assert/strict";
import { DispatchState, type LatLng, type Route, type Task } from "@/lib/contracts";
import { initialState, scenarios } from "@/lib/server/fixtures";
import { applyIncidentChanges, createCall } from "@/lib/server/incidents";
import { createSimulation, SCENE_SECONDS } from "@/lib/server/simulation";
import { startTask, releaseUnit } from "@/lib/server/task-lifecycle";
import { fleetInputKey } from "@/lib/server/candidates";
import { coordinates } from "@/lib/simulation/geometry";
import { estimateAvailability } from "@/lib/server/eta";

const flush = async () => { await new Promise((resolve) => setImmediate(resolve)); };
const route: Route = { geometry: [[-75.948, 42.1105], [-75.94, 42.11], [-75.9235, 42.096]], durationSeconds: 10, distanceMeters: 2500, estimated: false };

function harness(provider = async (from: LatLng, to: LatLng): Promise<Route> => ({
  ...structuredClone(route), geometry: [coordinates(from), coordinates(to)],
})) {
  let state = initialState(new Date("2026-11-07T22:00:00Z"));
  const store = {
    getState: () => state,
    mutate(fn: (s: DispatchState) => void | false) {
      if (fn(state) !== false) state.revision++;
    },
  };
  const sim = createSimulation(store, provider);
  function assign(queued = false) {
    const call = createCall(state, { now: state.simClock, location: scenarios["fall-unconscious"].location });
    const task: Task = {
      id: `task-${Object.keys(state.tasks).length}`, revision: 0, callId: call.id, ambulanceId: "amb-2",
      status: "queued", phase: null, acuityAtAcceptance: null, hospital: null, route: null,
      phaseEndsAt: null, etaAt: null, acceptedFromRecommendationId: null, override: null,
      createdAt: state.simClock, updatedAt: state.simClock,
    };
    call.status = "assigned"; call.taskId = task.id; state.tasks[task.id] = task;
    const unit = state.ambulances[task.ambulanceId];
    if (queued) unit.queuedTaskIds.push(task.id);
    else startTask(unit, task, state.simClock);
    return task;
  }
  return { store, sim, assign, replace() { state = initialState(); } };
}

async function main() {
  const h = harness();
  const task = h.assign(), queued = h.assign(true);
  const state = h.store.getState(), unit = state.ambulances["amb-2"];
  const initial = { ...unit.position };
  h.sim.tick(0); await flush();
  assert.ok(task.route && task.phaseEndsAt);
  assert.equal(task.etaAt, task.phaseEndsAt);
  const key = fleetInputKey(state), fleetRevision = state.fleetRevision;
  h.sim.tick(5);
  assert.notDeepEqual(unit.position, initial, "assigned unit moves before arrival");
  assert.equal(task.phase, "en_route");
  assert.equal(queued.status, "queued");
  assert.equal(fleetInputKey(state), key, "movement does not starve recommendation inference");
  assert.equal(state.fleetRevision, fleetRevision);
  h.sim.tick(5);
  assert.equal(task.phase, "on_scene");
  assert.deepEqual(unit.position, state.calls[task.callId].location.coords);
  h.sim.tick(SCENE_SECONDS); await flush();
  assert.equal(task.phase, "transporting");
  assert.ok(task.hospital && task.route);
  h.sim.tick(10); await flush();
  assert.equal(task.status, "completed");
  assert.equal(state.calls[task.callId].status, "closed");
  assert.deepEqual(unit.position, task.hospital.coords);
  assert.equal(unit.activeTaskId, queued.id);
  assert.equal(queued.status, "active");
  assert.ok(queued.route, "queued job receives its own route on activation");
  assert.deepEqual(queued.route.geometry[0], coordinates(task.hospital.coords), "queued route starts at the hospital");
  DispatchState.parse(state);

  // Persisted trips resume at their simulated timestamp without teleporting.
  const saved = structuredClone(state);
  const resumed = createSimulation({ getState: () => saved, mutate: (fn) => fn(saved) });
  resumed.tick(2);
  assert.notDeepEqual(saved.ambulances["amb-2"].position, unit.position);

  // The final job closes at the hospital; the available unit then drives home.
  h.sim.tick(10);
  h.sim.tick(SCENE_SECONDS); await flush();
  h.sim.tick(10); await flush();
  assert.equal(queued.status, "completed");
  assert.equal(unit.activeTaskId, null);
  assert.equal(unit.status, "available");
  assert.ok(unit.returnTrip?.route && unit.returnTrip.endsAt);
  assert.deepEqual(unit.returnTrip.route.geometry.at(-1), coordinates(unit.homeStation));
  assert.deepEqual(unit.homeStation, { lat: 42.0853645, lng: -75.9646999 });
  assert.equal(estimateAvailability(state, unit).availableInSeconds, 0);
  const returnKey = fleetInputKey(state);
  const hospitalPosition = { ...unit.position };
  h.sim.tick(5);
  assert.notDeepEqual(unit.position, hospitalPosition, "return journey moves without active tasks");
  assert.notDeepEqual(unit.position, unit.homeStation, "does not teleport home");
  assert.equal(fleetInputKey(state), returnKey, "return motion does not starve inference");
  const savedReturn = DispatchState.parse(structuredClone(state));
  const resumeReturn = createSimulation({ getState: () => savedReturn, mutate: (fn) => fn(savedReturn) });
  resumeReturn.tick(5);
  assert.deepEqual(savedReturn.ambulances[unit.id].position, unit.homeStation);
  assert.equal(savedReturn.ambulances[unit.id].returnTrip, null);

  const rerouteFrom = { ...unit.position };
  const diverted = h.assign();
  assert.equal(unit.returnTrip, null, "dispatch interrupts the return");
  h.sim.tick(0); await flush();
  assert.deepEqual(diverted.route?.geometry[0], coordinates(rerouteFrom));

  // Late return directions cannot overwrite a new assignment or a reset.
  for (const action of ["assign", "reset"] as const) {
    let resolve!: (r: Route) => void;
    const late = harness(() => new Promise<Route>((done) => { resolve = done; }));
    const current = late.store.getState();
    const returning = current.ambulances["amb-2"];
    returning.position = { ...current.hospitals[0].coords };
    releaseUnit(current, returning, current.simClock);
    late.sim.tick(0);
    if (action === "assign") late.assign();
    else { late.sim.reset(); late.replace(); }
    resolve(route); await flush();
    assert.ok(!late.store.getState().ambulances["amb-2"].returnTrip?.route);
  }

  // A route response arriving after reset/cancellation/location edits must be discarded.
  for (const action of ["reset", "cancel", "edit"] as const) {
    let resolve!: (r: Route) => void;
    const delayed = harness(() => new Promise<Route>((done) => { resolve = done; }));
    const pending = delayed.assign();
    delayed.sim.tick(0);
    const current = delayed.store.getState();
    if (action === "reset") { delayed.sim.reset(); delayed.replace(); }
    if (action === "cancel") {
      pending.status = "cancelled"; pending.phase = null;
      releaseUnit(current, current.ambulances["amb-2"], current.simClock);
    }
    if (action === "edit") applyIncidentChanges(current, current.calls[pending.callId], {
      location: { coords: { lat: 42.1, lng: -75.9 } }, now: current.simClock,
    });
    resolve(route); await flush();
    assert.equal(pending.route, null, `late route discarded after ${action}`);
  }

  // Unknown locations stay pending; they must never travel to an invented point.
  const unknown = harness();
  const unknownTask = unknown.assign();
  unknown.store.getState().calls[unknownTask.callId].location.coords = null;
  unknown.sim.tick(30); await flush();
  assert.equal(unknownTask.route, null);
  assert.equal(unknownTask.phase, "en_route");
  assert.deepEqual(coordinates(unknown.store.getState().ambulances["amb-2"].position), coordinates(initial));
  console.log("Simulation: movement, scene/transport, queue pickup, return home, return interruption/resume, recommendation stability, late-route guards and unknown locations passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
