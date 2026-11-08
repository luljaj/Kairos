import assert from "node:assert/strict";
import { DispatchState } from "@/lib/contracts";
import { FLEET_DEMO_SCENARIOS } from "@/lib/demo/scenarios";
import { initialState, scenarios } from "@/lib/server/fixtures";
import { buildCandidates, buildModelRequest } from "@/lib/server/candidates";
import { createCall } from "@/lib/server/incidents";
import { fallbackResponse } from "@/lib/server/fallback";
import { getState } from "@/lib/server/store";
import { applyCommand } from "@/lib/server/commands";
import { cancelScriptedCalls } from "@/lib/server/scripted";
import { createSimulation, resetSimulation } from "@/lib/server/simulation";
import { resetRecommendations } from "@/lib/server/recommend";
import { POST } from "@/app/api/demo/scripted-call/route";
import { randomIncidents } from "@/lib/server/random-incidents";
import { PREMADE_INCIDENTS } from "@/lib/demo/premade-incidents";
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
    const samples = randomIncidents(3, () => 0);
    assert.equal(new Set(samples.map((sample) => sample.title)).size, 3);
    assert.equal(new Set(samples.map((sample) => sample.location.text)).size, 3);
    assert.notEqual(randomIncidents(1, () => 0)[0].title, randomIncidents(1, () => 0.99)[0].title);
    for (const preset of FLEET_DEMO_SCENARIOS) {
      assert.equal((await POST(request(preset.id))).status, 200);
      assert.equal(globalThis.__simulation?.speed, 1, "judge presets use real-time simulation");
      const state = DispatchState.parse(getState());
      const units = Object.values(state.ambulances);
      assert.equal(units.length, 3);
      assert.equal(new Set(units.map((unit) => JSON.stringify(unit.position))).size, 3);
      const busyCounts: Record<string, number> = { "fleet-spread": 1, "fleet-mixed": 2, "fleet-busy": 3, "fleet-experience": 0 };
      assert.equal(units.filter((unit) => unit.status === "busy").length, busyCounts[preset.id]);
      const fixture = scenarios[preset.intake];
      const probe = createCall(state, { now: state.simClock, location: fixture.location,
        facts: Object.assign({}, ...fixture.steps.map((step) => step.facts)) });
      const candidates = buildCandidates(state, probe);
      if (preset.id === "fleet-experience") {
        const input = buildModelRequest(state, probe, candidates, "req-demo");
        const faster = input.candidates.find((c) => c.ambulanceId === "amb-2")!;
        const experienced = input.candidates.find((c) => c.ambulanceId === "amb-3")!;
        const delta = experienced.arrivalInSeconds! - faster.arrivalInSeconds!;
        assert.ok(delta > 0 && delta <= 60, "experience tradeoff must fit the existing rubric");
        assert.equal(faster.careLevel, "ALS");
        assert.equal(experienced.careLevel, "ALS");
        const chief = (c: typeof faster) => c.crew.find((member) => member.role === "crew_chief")!;
        assert.ok(chief(experienced).monthsOfService - chief(faster).monthsOfService >= 24);
        assert.deepEqual(state.crew, initialState().crew, "demo does not inflate crew qualifications");
        const baseline = fallbackResponse(input);
        assert.equal(baseline.status, "ready");
        if (baseline.status === "ready") assert.equal(baseline.recommendedAmbulanceId, "amb-2", "fallback must not impersonate model experience judgement");
      }
      if (preset.id === "fleet-busy") {
        const loaded = candidates.find((c) => c.ambulanceId === "amb-3")!;
        const transporting = candidates.find((c) => c.ambulanceId === "amb-2")!;
        assert.ok(loaded.arrivalInSeconds! > transporting.arrivalInSeconds!, "nearby unit's backlog affects arrival");
      }
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
      assert.equal(globalThis.__simulation?.speed, 0, "Clear restores the configured simulation speed");
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
    for (const [index, preset] of PREMADE_INCIDENTS.entries()) {
      const fixture = scenarios[preset.id];
      const response = await POST(request(preset.id));
      assert.equal(response.status, 200);
      const started = await response.json();
      await pause(20);
      const call = Object.values(getState().calls).find((call) => call.conversationId === started.conversationId)!;
      assert.ok(call, "named script creates an incident");
      assert.equal(call.facts.patientAge, null, "follow-up details arrive later");
      assert.deepEqual(call.location.coords, fixture.location.coords);
      await pause(450);
      const expected = Object.assign({}, ...fixture.steps.map((step) => step.facts));
      for (const [key, value] of Object.entries(expected)) assert.equal(call.facts[key as keyof typeof call.facts], value);
      assert.equal(call.transcript.length, 2);
      assert.equal(call.taskId, null, "scripts do not assign a unit automatically");
      assert.equal(Object.keys(getState().calls).length, index + 1, "premade calls append without replacing earlier calls");
    }
    applyCommand({ type: "reset_demo", commandId: crypto.randomUUID() });
    const existing = createCall(getState(), { now: getState().simClock,
      location: scenarios["busy-first-call"].location, facts: { chiefComplaint: "Existing patient" } });
    assert.ok(applyCommand({ type: "manual_assign", callId: existing.id, ambulanceId: "amb-1", commandId: crypto.randomUUID() }).ok);
    const activeTaskId = getState().ambulances["amb-1"].activeTaskId;
    assert.equal((await POST(request("random-burst"))).status, 200);
    await pause(850);
    const randomCalls = Object.values(getState().calls).filter((call) => call.id !== existing.id);
    assert.equal(randomCalls.length, 3);
    assert.equal(new Set(randomCalls.map((call) => call.conversationId)).size, 3);
    assert.equal(new Set(randomCalls.map((call) => call.facts.chiefComplaint)).size, 3);
    assert.ok(randomCalls.every((call) => call.location.coords && call.facts.patientAge !== null));
    assert.equal(getState().ambulances["amb-1"].activeTaskId, activeTaskId, "random calls preserve existing assignments");
    assert.equal((await POST(request("random-incident"))).status, 200);
    await pause(220);
    assert.equal(Object.keys(getState().calls).length, 5, "one random call appends to the existing queue");
    assert.equal((await POST(request("random-burst"))).status, 200);
    await pause(20);
    applyCommand({ type: "reset_demo", commandId: crypto.randomUUID() });
    await pause(850);
    assert.deepEqual(getState().calls, {}, "Clear cancels future random arrivals and updates");
    assert.deepEqual(getState().tasks, {});
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
