import assert from "node:assert/strict";
import { DispatchState } from "@/lib/contracts";
import { FLEET_DEMO_SCENARIOS } from "@/lib/demo/scenarios";
import { initialState } from "@/lib/server/fixtures";
import { getState } from "@/lib/server/store";
import { applyCommand } from "@/lib/server/commands";
import { cancelScriptedCalls } from "@/lib/server/scripted";
import { createSimulation, resetSimulation } from "@/lib/server/simulation";
import { resetRecommendations } from "@/lib/server/recommend";
import { POST } from "@/app/api/demo/scripted-call/route";
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const request = (scenario: string) => new Request("http://localhost/api/demo/scripted-call", {
  method: "POST", body: JSON.stringify({ scenario, speed: 20 }),
});
async function main() {
  // Suppress persistence so this check cannot overwrite the user's saved demo.
  const persistTimer = setTimeout(() => {}, 60_000);
  globalThis.__dispatch = { state: initialState(), listeners: new Set(), seenCommands: new Map(), persistTimer };
  process.env.SIM_SPEED = "0";
  try {
    for (const [index, preset] of FLEET_DEMO_SCENARIOS.entries()) {
      assert.equal((await POST(request(preset.id))).status, 200);
      const state = DispatchState.parse(getState());
      const units = Object.values(state.ambulances);
      assert.equal(units.length, 3);
      assert.equal(new Set(units.map((unit) => JSON.stringify(unit.position))).size, 3);
      assert.equal(units.filter((unit) => unit.status === "busy").length, index + 1);
      for (const unit of units) {
        if (!unit.activeTaskId && !unit.returnTrip) {
          assert.deepEqual(unit.position, unit.homeStation, "idle units must be at the squad room");
        }
        if (unit.activeTaskId && state.tasks[unit.activeTaskId].phase === "on_scene") {
          assert.deepEqual(unit.position, state.calls[state.tasks[unit.activeTaskId].callId].location.coords);
        }
        for (const id of [unit.activeTaskId, ...unit.queuedTaskIds]) {
          if (!id) continue;
          const task = state.tasks[id];
          assert.equal(task.ambulanceId, unit.id);
          assert.equal(state.calls[task.callId].taskId, id);
        }
      }
      if (preset.id === "fleet-busy") assert.equal(state.ambulances["amb-3"].queuedTaskIds.length, 1);
      if (preset.id === "fleet-spread") {
        // Exercise the real simulation with deterministic routes on an isolated snapshot.
        const sim = createSimulation({ getState: () => state, mutate: (fn) => fn(state) }, async (from, to) => ({
          geometry: [[from.lng, from.lat], [to.lng, to.lat]],
          durationSeconds: 10, distanceMeters: 1000, estimated: true,
        }));
        const starts = ["amb-1", "amb-2"].map((id) => ({ ...state.ambulances[id].position }));
        sim.tick(0);
        await pause(0);
        sim.tick(5);
        for (const [i, id] of ["amb-1", "amb-2"].entries()) {
          assert.notDeepEqual(state.ambulances[id].position, starts[i], "returning units move");
          assert.equal(state.ambulances[id].status, "available");
        }
        sim.tick(5);
        for (const id of ["amb-1", "amb-2"]) {
          assert.deepEqual(state.ambulances[id].position, state.ambulances[id].homeStation);
          assert.equal(state.ambulances[id].returnTrip, null);
        }
        sim.reset();
      }
      await pause(20);
      assert.ok(Object.values(getState().calls).some((call) => call.conversationId?.startsWith("scripted-")));
      applyCommand({ type: "reset_demo", commandId: crypto.randomUUID() });
      await pause(850); // Clear must also cancel the remaining intake timers.
      const cleared = getState();
      assert.deepEqual(cleared.calls, {});
      assert.deepEqual(cleared.tasks, {});
      assert.deepEqual(cleared.recommendations, {});
      for (const unit of Object.values(cleared.ambulances)) {
        assert.deepEqual(unit.position, unit.homeStation);
        assert.equal(unit.status, "available");
        assert.equal(unit.activeTaskId, null);
        assert.deepEqual(unit.queuedTaskIds, []);
        assert.equal(unit.returnTrip ?? null, null);
      }
    }
    const before = getState();
    assert.equal((await POST(request("unknown"))).status, 404);
    assert.equal(getState(), before);
    console.log("Fleet demos: presets, linked incidents, incoming calls, Clear cancellation and home reset passed.");
  } finally {
    cancelScriptedCalls(); resetSimulation(); resetRecommendations(); clearTimeout(persistTimer);
    globalThis.__dispatch = undefined;
  }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
