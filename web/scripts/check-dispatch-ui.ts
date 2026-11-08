import assert from "node:assert/strict";
import { createCommandRunner } from "@/lib/client/command-action";
import {
  durationLabel,
  selectedCall,
  selectedCandidate,
  taskArrival,
  unitStatus,
} from "@/lib/client/dispatch-view";
import { initialState, scenarios } from "@/lib/server/fixtures";
import { createCall } from "@/lib/server/incidents";
import { buildCandidates } from "@/lib/server/candidates";
import type { CommandResult, Task } from "@/lib/contracts";

async function main() {
  const state = initialState();
  assert.equal(selectedCall(state, null), null);
  const call = createCall(state, {
    now: state.simClock,
    location: scenarios["fall-unconscious"].location,
    facts: {},
  });
  const other = createCall(state, {
    now: state.simClock,
    location: scenarios["breathing-charlie"].location,
    facts: {},
  });
  assert.equal(selectedCall(state, null)?.id, call.id);
  assert.equal(selectedCall(state, other.id)?.id, other.id);
  assert.equal(selectedCall(initialState(), call.id), null);
  const candidates = buildCandidates(state, call);
  assert.equal(
    selectedCandidate(candidates, candidates[1].ambulanceId),
    candidates[1],
  );
  assert.equal(
    selectedCandidate(candidates.slice(1), candidates[0].ambulanceId),
    candidates[1],
  );
  assert.equal(durationLabel(null), "Unknown");
  assert.equal(durationLabel(undefined), "Unknown");
  assert.equal(durationLabel(0), "0 min");
  assert.equal(durationLabel(61), "2 min");
  const task: Task = {
    id: "task-test",
    revision: 0,
    callId: call.id,
    ambulanceId: "amb-3",
    status: "active",
    phase: "on_scene",
    acuityAtAcceptance: null,
    hospital: null,
    route: null,
    phaseEndsAt: null,
    etaAt: new Date(Date.parse(state.simClock) + 123000).toISOString(),
    acceptedFromRecommendationId: null,
    override: null,
    createdAt: state.simClock,
    updatedAt: state.simClock,
  };
  state.tasks[task.id] = task;
  state.ambulances["amb-3"].activeTaskId = task.id;
  assert.equal(unitStatus(state.ambulances["amb-3"], state), "On scene");
  assert.equal(taskArrival(task, state), 123);
  assert.equal(taskArrival({ ...task, etaAt: null }, state), null);

  const ids: string[] = [];
  let finish!: (result: CommandResult) => void;
  let attempts = 0;
  const runner = createCommandRunner(async (_command, id) => {
    ids.push(id);
    attempts++;
    if (attempts === 1) throw new Error("Acknowledgement lost");
    return new Promise<CommandResult>((resolve) => {
      finish = resolve;
    });
  });
  const command = { type: "request_recommendation" as const, callId: call.id };
  const uncertain = await runner.run(command);
  assert.equal(uncertain?.result, null);
  assert.equal(
    await runner.run(command),
    null,
    "new actions blocked until uncertain outcome resolved",
  );
  const retry = runner.run(command, true);
  assert.equal(
    await runner.run(command, true),
    null,
    "rapid retries cannot submit twice",
  );
  finish({ ok: true, revision: 10 });
  assert.equal((await retry)?.result?.ok, true);
  assert.equal(ids[0], ids[1], "retry preserves the logical action ID");
  const obsolete = runner.run(command);
  runner.reset();
  finish({ ok: true, revision: 11 });
  assert.equal(
    await obsolete,
    null,
    "late acknowledgements after reset are ignored",
  );
  console.log(
    "Dashboard selection, unknown durations, task phases, retry identity, and reset races passed.",
  );
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
