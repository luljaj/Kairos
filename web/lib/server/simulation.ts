import type { Ambulance, DispatchState, LatLng, Route, Task } from "@/lib/contracts";
import { measure, pointAt } from "@/lib/simulation/geometry";
import { fleetChanged } from "./incidents";
import { nearestHospital } from "./eta";
import { getRoute } from "./routing";
import { advancePhase } from "./task-lifecycle";
import { getState, mutate, touch } from "./store";
import { scheduleAwaitingRecommendations } from "./recommend";

export const SIM_TICK_MS = 250;
export const SCENE_SECONDS = 480;
const SIM_VERSION = "judge-demo-speed-v2";
type Store = {
  getState: () => DispatchState;
  mutate: (fn: (state: DispatchState) => void | false) => unknown;
};

/** Shared server simulation: every browser sees the same trip, queue and phase. */
export function createSimulation(
  store: Store,
  routeFor: (from: LatLng, to: LatLng) => Promise<Route> = getRoute,
  changed: () => void = () => {},
) {
  const pending = new Map<string, symbol>();
  const measured = new WeakMap<Route, ReturnType<typeof measure>>();
  let generation = 0;

  function destination(state: DispatchState, task: Task) {
    return task.phase === "en_route" ? state.calls[task.callId]?.location.coords : task.hospital?.coords;
  }

  function prepare(state: DispatchState, task: Task) {
    const unit = state.ambulances[task.ambulanceId];
    if (!unit || task.status !== "active" || unit.activeTaskId !== task.id) return;
    if (task.phase === "on_scene") {
      if (!task.phaseEndsAt) {
        task.phaseEndsAt = new Date(Date.parse(state.simClock) + SCENE_SECONDS * 1000).toISOString();
        touch(task, state.simClock);
        fleetChanged(state);
      }
      return;
    }
    if (task.phase !== "en_route" && task.phase !== "transporting") return;
    if (task.phase === "transporting") task.hospital ??= nearestHospital(state, unit.position);
    const target = destination(state, task);
    if (!target || pending.has(task.id)) return;
    if (task.route && task.phaseEndsAt && task.route.geometry.length >= 2) return;
    const ticket = Symbol(task.id), version = generation, phase = task.phase;
    const targetKey = JSON.stringify(target);
    pending.set(task.id, ticket);
    void routeFor({ ...unit.position }, { ...target }).then((route) => {
      if (generation !== version || pending.get(task.id) !== ticket) return;
      store.mutate((current) => {
        const live = current.tasks[task.id];
        if (current !== state || live !== task || live.status !== "active" || live.phase !== phase
            || current.ambulances[task.ambulanceId]?.activeTaskId !== task.id
            || JSON.stringify(destination(current, live)) !== targetKey) return false;
        live.route = route;
        live.phaseEndsAt = new Date(Date.parse(current.simClock) + Math.max(1, route.durationSeconds) * 1000).toISOString();
        if (phase === "en_route") live.etaAt = live.phaseEndsAt;
        touch(live, current.simClock);
        fleetChanged(current);
      });
      changed();
    }).catch(() => {
      // A custom provider may reject; the next tick can retry. getRoute includes a fallback.
    }).finally(() => {
      if (pending.get(task.id) === ticket) pending.delete(task.id);
    });
  }

  function returnHome(state: DispatchState, unit: Ambulance) {
    const trip = unit.returnTrip;
    if (!trip) return;
    if (unit.status !== "available" || unit.activeTaskId || unit.queuedTaskIds.length) {
      unit.returnTrip = null;
      touch(unit, state.simClock);
      return;
    }
    if (trip.route && trip.endsAt) {
      const remaining = (Date.parse(trip.endsAt) - Date.parse(state.simClock)) / 1000;
      let geometry = measured.get(trip.route);
      if (!geometry) { geometry = measure(trip.route.geometry); measured.set(trip.route, geometry); }
      const { pos } = pointAt(geometry, 1 - remaining / Math.max(1, trip.route.durationSeconds));
      unit.position = remaining <= 0 ? { ...unit.homeStation } : { lng: pos[0], lat: pos[1] };
      if (remaining <= 0) {
        unit.returnTrip = null;
        fleetChanged(state);
      }
      touch(unit, state.simClock);
      return;
    }
    const key = `return:${unit.id}`;
    if (pending.has(key)) return;
    const ticket = Symbol(key), version = generation;
    const targetKey = JSON.stringify(unit.homeStation);
    pending.set(key, ticket);
    void routeFor({ ...unit.position }, { ...unit.homeStation }).then((route) => {
      if (generation !== version || pending.get(key) !== ticket) return;
      if (route.geometry.length < 2) return;
      store.mutate((current) => {
        const live = current.ambulances[unit.id];
        if (current !== state || live !== unit || live.returnTrip !== trip
            || live.status !== "available" || live.activeTaskId || live.queuedTaskIds.length
            || JSON.stringify(live.homeStation) !== targetKey) return false;
        trip.route = route;
        trip.endsAt = new Date(Date.parse(current.simClock) + Math.max(1, route.durationSeconds) * 1000).toISOString();
        touch(live, current.simClock);
        fleetChanged(current);
      });
      changed();
    }).catch(() => {
      // Retry on the next tick; the standard provider includes an estimated fallback.
    }).finally(() => {
      if (pending.get(key) === ticket) pending.delete(key);
    });
  }

  return {
    reset() { generation++; pending.clear(); },
    tick(seconds: number) {
      const before = store.getState().fleetRevision;
      store.mutate((state) => {
        const tasks = Object.values(state.tasks).filter((task) => task.status === "active");
        if (!tasks.length && !Object.values(state.ambulances).some((unit) => unit.returnTrip)) return false;
        state.simClock = new Date(Date.parse(state.simClock) + Math.max(0, seconds) * 1000).toISOString();
        for (const task of tasks) {
          prepare(state, task);
          if (!task.phaseEndsAt) continue;
          const remaining = (Date.parse(task.phaseEndsAt) - Date.parse(state.simClock)) / 1000;
          const unit = state.ambulances[task.ambulanceId];
          if (!unit || unit.activeTaskId !== task.id) continue;
          if (task.route && task.route.geometry.length >= 2 && task.phase !== "on_scene") {
            let geometry = measured.get(task.route);
            if (!geometry) { geometry = measure(task.route.geometry); measured.set(task.route, geometry); }
            const { pos } = pointAt(geometry, 1 - remaining / Math.max(1, task.route.durationSeconds));
            unit.position = { lng: pos[0], lat: pos[1] };
            touch(unit, state.simClock);
          }
          if (remaining <= 0) {
            advancePhase(state, task, state.simClock);
            prepare(state, task);
            const next = unit.activeTaskId ? state.tasks[unit.activeTaskId] : null;
            if (next && next !== task) prepare(state, next);
          }
        }
        for (const unit of Object.values(state.ambulances)) returnHome(state, unit);
      });
      if (store.getState().fleetRevision !== before) changed();
    },
  };
}

declare global {
  var __simulation: {
    version?: string;
    speed: number;
    engine: ReturnType<typeof createSimulation>;
    timer: ReturnType<typeof setInterval>;
  } | undefined;
}

export function ensureSimulationStarted(speedOverride?: number) {
  if (globalThis.__simulation?.version === SIM_VERSION) {
    if (speedOverride !== undefined) globalThis.__simulation.speed = speedOverride;
    return;
  }
  // HMR preserves globals: retire an older engine without resetting dispatch state.
  resetSimulation();
  const engine = createSimulation({ getState, mutate }, getRoute, scheduleAwaitingRecommendations);
  const configured = speedOverride ?? Number(process.env.SIM_SPEED ?? 6);
  const speed = Number.isFinite(configured) && configured >= 0 ? configured : 6;
  let last = performance.now();
  const timer = setInterval(() => {
    const now = performance.now();
    // Resume from persisted sim time; do not replay hours of downtime or laptop sleep.
    const elapsed = Math.min(1, (now - last) / 1000);
    last = now;
    engine.tick(elapsed * (globalThis.__simulation?.speed ?? speed));
  }, SIM_TICK_MS);
  timer.unref();
  globalThis.__simulation = { version: SIM_VERSION, engine, timer, speed };
}

export function resetSimulation() {
  const runtime = globalThis.__simulation;
  if (!runtime) return;
  clearInterval(runtime.timer);
  runtime.engine.reset();
  globalThis.__simulation = undefined;
}
