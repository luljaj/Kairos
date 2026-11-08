import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import {
  CommandResult, DispatchState, GetAssignmentResult, TOOL_SECRET_HEADER, UpdateIncidentResult,
  type Call, type Command,
} from "@/lib/contracts";
import { scenarios } from "@/lib/server/fixtures";

const host = "127.0.0.1";
const port = 3001;
const origin = `http://${host}:${port}`;
const snapshotPath = "data/state.json";
const secret = crypto.randomUUID();
const requestTimeoutMs = 5000;
type CommandBody = Command extends infer C ? C extends Command ? Omit<C, "commandId"> : never : never;

async function waitFor<T>(label: string, predicate: () => T | undefined, ms = 10_000): Promise<T> {
  const end = performance.now() + ms;
  do {
    const value = predicate();
    if (value !== undefined) return value;
    await delay(25);
  } while (performance.now() < end);
  throw new Error(`Timed out waiting for ${label}`);
}

async function post(path: string, body: unknown = {}, headers: Record<string, string> = {}) {
  const response = await fetch(origin + path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  assert.ok(response.ok, `${path} returned ${response.status}`);
  return response.json();
}

async function command(body: CommandBody, commandId = crypto.randomUUID()) {
  return CommandResult.parse(await post("/api/commands", { commandId, ...body }));
}

async function connect() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const response = await fetch(origin + "/api/events", { signal: controller.signal })
    .finally(() => clearTimeout(timeout));
  assert.ok(response.ok && response.body);
  assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const frames: DispatchState[] = [];
  let error: unknown;
  const read = (async () => {
    let buffered = "";
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffered += decoder.decode(chunk.value, { stream: true });
        let end: number;
        while ((end = buffered.indexOf("\n\n")) >= 0) {
          const lines = buffered.slice(0, end).split("\n");
          buffered = buffered.slice(end + 2);
          if (!lines.includes("event: state")) continue;
          const json = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
          const state = DispatchState.parse(JSON.parse(json));
          const previous = frames.at(-1);
          assert.ok(!previous || previous.revision <= state.revision);
          frames.push(state);
        }
      }
      if (!controller.signal.aborted) throw new Error("SSE stream ended early");
    } catch (err) {
      if (!controller.signal.aborted) error = err;
    } finally {
      reader.releaseLock();
    }
  })();
  return {
    latest: () => {
      if (error) throw error;
      return frames.at(-1);
    },
    wait: (label: string, predicate: (state: DispatchState) => boolean, ms?: number) =>
      waitFor(label, () => {
        if (error) throw error;
        return frames.findLast(predicate);
      }, ms),
    async close() {
      controller.abort();
      await read;
      if (error) throw error;
    },
  };
}

const callFor = (state: DispatchState, conversationId: string) =>
  Object.values(state.calls).find((call) => call.conversationId === conversationId);

function recommendation(state: DispatchState, call: Call | undefined) {
  return call?.recommendationSetId ? state.recommendations[call.recommendationSetId] : undefined;
}

async function scripted(scenario: string, speed: number): Promise<string> {
  const result = await post("/api/demo/scripted-call", { scenario, speed });
  assert.equal(result.ok, true);
  assert.equal(typeof result.conversationId, "string");
  return result.conversationId;
}

async function assertPortFree() {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(port, host, () => probe.close((error) => error ? reject(error) : resolve()));
  });
}

async function startServer(): Promise<{ stop: () => Promise<void> }> {
  await assertPortFree();
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", host, "-p", String(port)], {
    env: { ...process.env, MODEL_MODE: "mock", MODEL_PROVIDER: "compatible", MODEL_RESPONSE_FORMAT: "json_schema",
      MODEL_BASE_URL: "http://127.0.0.1:8000/v1", MODEL_API_KEY: "", VOICE_TOOL_SECRET: secret },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  let spawnError: Error | undefined;
  child.once("error", (error) => { spawnError = error; });
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  try {
    await waitFor("Next.js startup", () => {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null) throw new Error(output);
      return output.includes("Ready in") ? true : undefined;
    });
  } catch (error) {
    await stopServer(child);
    throw error;
  }
  return { stop: () => stopServer(child) };
}

async function stopServer(child: ChildProcess) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    const force = setTimeout(() => child.kill("SIGKILL"), 3000);
    child.once("exit", () => { clearTimeout(force); resolve(); });
    child.kill("SIGTERM");
  });
}

function assertUniqueTask(state: DispatchState, call: Call, taskId: string) {
  const unitReferences = Object.values(state.ambulances).flatMap((u) => [u.activeTaskId, ...u.queuedTaskIds]);
  assert.deepEqual(Object.values(state.tasks).filter((task) => task.callId === call.id).map((task) => task.id), [taskId]);
  assert.equal(unitReferences.filter((id) => id === taskId).length, 1);
  assert.equal(call.taskId, taskId);
}

async function checkFlow(sse: Awaited<ReturnType<typeof connect>>) {
  assert.equal(CommandResult.parse(await post("/api/demo/reset")).ok, true);

  const fall = await scripted("fall-unconscious", 2);
  const missing = (state: DispatchState, field: string) =>
    recommendation(state, callFor(state, fall))?.missingFields.some((f) => f === field) ?? false;
  await sse.wait("chief complaint requested", (state) => missing(state, "chiefComplaint"));
  await sse.wait("consciousness requested", (state) => missing(state, "conscious") && missing(state, "breathingNormally"));
  const ready = await sse.wait("final Delta recommendation", (state) => {
    const call = callFor(state, fall);
    return call?.facts.patientAge === 67 && recommendation(state, call)?.status === "ready";
  }, 20_000);
  const fallCall = callFor(ready, fall)!;
  const fallSet = recommendation(ready, fallCall)!;
  assert.equal(fallSet.acuity, "Delta");
  assert.equal(fallSet.recommendedAmbulanceId, scenarios["fall-unconscious"].expected.recommendedAmbulanceId);
  assert.equal(fallSet.source, "fallback");
  assert.equal(fallSet.candidates.length, 3);

  const accept = { type: "accept_recommendation", recommendationSetId: fallSet.id, ambulanceId: fallSet.recommendedAmbulanceId! } as const;
  const commandId = crypto.randomUUID();
  const accepted = await command(accept, commandId);
  assert.ok(accepted.ok && accepted.createdId && accepted.queued === false);
  const taskId = accepted.createdId;
  assert.deepEqual(await command(accept, commandId), accepted);
  const conflict = await command(accept);
  assert.ok(!conflict.ok && conflict.error === "conflict");
  const assigned = await sse.wait("accepted task over SSE", (state) => !!state.tasks[taskId]);
  assertUniqueTask(assigned, assigned.calls[fallCall.id], taskId);

  const unit = assigned.ambulances[accept.ambulanceId];
  const task = assigned.tasks[taskId];
  const assignment = GetAssignmentResult.parse(await post("/api/voice/tools/get-assignment", { conversationId: fall },
    { [TOOL_SECRET_HEADER]: secret }));
  assert.ok(task.etaAt);
  assert.deepEqual(assignment, {
    state: "assigned", unitName: unit.name, queued: false,
    etaMinutes: Math.round((Date.parse(task.etaAt) - Date.parse(assigned.simClock)) / 60_000),
  });

  const busy = await scripted("busy-first-call", 3);
  const busyReady = await sse.wait("Bravo recommendation", (state) => recommendation(state, callFor(state, busy))?.acuity === "Bravo");
  const busyCall = callFor(busyReady, busy)!;
  const candidate = recommendation(busyReady, busyCall)?.candidates.find((c) => c.ambulanceId === unit.id);
  assert.ok(candidate && candidate.availableInSeconds !== null && candidate.availableInSeconds > 480);
  const queued = await command({ type: "manual_assign", callId: busyCall.id, ambulanceId: unit.id });
  assert.ok(queued.ok && queued.queued && queued.createdId);
  const queuedId = queued.createdId;
  const queueState = await sse.wait("queued task over SSE", (state) => !!state.tasks[queuedId]);
  assertUniqueTask(queueState, queueState.calls[busyCall.id], queuedId);
  const queuedEta = queueState.tasks[queuedId].etaAt;
  assert.ok(queuedEta && Date.parse(queuedEta) > Date.parse(task.etaAt));
  assert.equal(Date.parse(queuedEta), Date.parse(queueState.simClock) + candidate.arrivalInSeconds! * 1000);

  const breathing = await scripted("breathing-charlie", 3);
  let state = await sse.wait("Charlie recommendation", (snapshot) => {
    const call = callFor(snapshot, breathing);
    return call?.facts.conscious === true && recommendation(snapshot, call)?.acuity === "Charlie";
  });
  const breathingId = callFor(state, breathing)!.id;
  let current = recommendation(state, state.calls[breathingId])!;
  for (const phase of ["on_scene", "transporting", "completed"] as const) {
    const old = current;
    const expectedRevision = state.fleetRevision + 1;
    assert.ok((await command({ type: "advance_phase", taskId })).ok);
    const stale = await command({ type: "accept_recommendation", recommendationSetId: old.id, ambulanceId: "amb-2" });
    assert.ok(!stale.ok && stale.error === "stale");
    state = await sse.wait(`fleet refresh after ${phase}`, (snapshot) =>
      snapshot.tasks[taskId]?.phase === phase && snapshot.fleetRevision === expectedRevision
      && recommendation(snapshot, snapshot.calls[breathingId])?.status === "ready"
      && snapshot.recommendations[old.id]?.status === "stale");
    current = recommendation(state, state.calls[breathingId])!;
    assert.equal(current.fleetRevision, expectedRevision);
    assert.notEqual(current.id, old.id);
  }
  const closedRefresh = await command({ type: "request_recommendation", callId: fallCall.id });
  assert.ok(!closedRefresh.ok && closedRefresh.error === "conflict");
  assert.equal(state.ambulances[unit.id].activeTaskId, queuedId);
  assertUniqueTask(state, state.calls[busyCall.id], queuedId);

  const mismatch = { type: "accept_recommendation", recommendationSetId: current.id, ambulanceId: "amb-1" } as const;
  assert.ok((await command({ type: "override_acuity", callId: breathingId, acuity: "Delta" })).ok);
  const rejected = await command(mismatch);
  assert.ok(!rejected.ok && rejected.error === "mismatch_unconfirmed");
  state = await sse.wait("local override without a new recommendation", (snapshot) =>
    snapshot.calls[breathingId]?.acuity?.source === "dispatcher"
    && snapshot.calls[breathingId].recommendationSetId === current.id);
  assert.equal(state.calls[breathingId].taskId, null);
  assert.equal(state.recommendations[current.id].candidates.at(-1)?.capabilityMismatch, true);
  const confirmed = await command({ ...mismatch, confirmMismatch: true });
  assert.ok(confirmed.ok && confirmed.createdId);
  const confirmedId = confirmed.createdId;
  const afterConfirm = await sse.wait("confirmed mismatch task", (snapshot) => !!snapshot.tasks[confirmedId]);
  assert.equal(afterConfirm.tasks[confirmedId].override?.reason, "capability_mismatch_confirmed");
  assertUniqueTask(afterConfirm, afterConfirm.calls[breathingId], confirmedId);
  const cancelled = await command({ type: "cancel_task", taskId: confirmedId });
  assert.ok(cancelled.ok);
  const reopened = await sse.wait("cancelled call refreshed", (snapshot) =>
    snapshot.tasks[confirmedId]?.status === "cancelled"
    && snapshot.calls[breathingId]?.taskId === null
    && recommendation(snapshot, snapshot.calls[breathingId])?.status === "ready");
  assert.equal(reopened.ambulances["amb-1"].activeTaskId, null);
  assert.equal(reopened.calls[breathingId].acuity?.value, "Delta");

  const scriptedBeforeReset = await scripted("fall-unconscious", 4);
  await sse.wait("scripted call before reset", (snapshot) => !!callFor(snapshot, scriptedBeforeReset));
  const reset = CommandResult.parse(await post("/api/demo/reset"));
  assert.ok(reset.ok);
  await sse.wait("empty reset", (snapshot) => snapshot.revision >= reset.revision && Object.keys(snapshot.calls).length === 0);
  await delay(4000); // Beyond every remaining step at the chosen speed.
  const empty = sse.latest()!;
  assert.equal(empty.revision, reset.revision);
  assert.deepEqual([empty.calls, empty.tasks, empty.recommendations], [{}, {}, {}]);
  console.log("All three scripted calls, SSE acceptance, queueing, voice ETA, phase changes, and reset passed.");
}

async function checkHooksAndSave(sse: Awaited<ReturnType<typeof connect>>) {
  const location = scenarios["fall-unconscious"].location;
  const created = await command({ type: "create_manual_call", location, facts: { chiefComplaint: "Slipped and hurt wrist" } });
  assert.ok(created.ok && created.createdId);
  const id = created.createdId;
  let state = await sse.wait("new call recommendation", (snapshot) => recommendation(snapshot, snapshot.calls[id])?.status === "ready");
  const initial = recommendation(state, state.calls[id])!;
  const edit = await command({ type: "edit_incident", callId: id, location: { text: "Corrected street text" } });
  assert.ok(edit.ok);
  state = await sse.wait("address-only refresh", (snapshot) => {
    const set = recommendation(snapshot, snapshot.calls[id]);
    return set?.status === "ready" && set.id !== initial.id;
  });
  const afterEdit = recommendation(state, state.calls[id])!;
  assert.equal(afterEdit.factsRevision, initial.factsRevision);

  const voice = { conversationId: "voice-repeat", facts: { chiefComplaint: "Headache" } };
  const voiceHeaders = { [TOOL_SECRET_HEADER]: secret };
  const intake = UpdateIncidentResult.parse(await post("/api/voice/tools/update-incident", voice, voiceHeaders));
  const voiceId = intake.callId;
  state = await sse.wait("voice address prerequisites", (snapshot) => recommendation(snapshot, snapshot.calls[voiceId])?.status === "needs_more_info");
  assert.deepEqual(recommendation(state, state.calls[voiceId])?.missingFields, ["location"]);
  assert.deepEqual(await post("/api/voice/tools/update-incident", voice, voiceHeaders), intake);

  const repeatId = crypto.randomUUID();
  const request = { type: "request_recommendation", callId: id } as const;
  const requested = await command(request, repeatId);
  assert.ok(requested.ok);
  assert.deepEqual(await command(request, repeatId), requested);
  const missingCall = await command({ type: "request_recommendation", callId: "call-absent" });
  assert.ok(!missingCall.ok && missingCall.error === "not_found");
  state = await sse.wait("explicit refresh", (snapshot) => {
    const set = recommendation(snapshot, snapshot.calls[id]);
    return snapshot.revision >= requested.revision && set?.status === "ready" && set.id !== afterEdit.id;
  });
  const readyId = recommendation(state, state.calls[id])!.id;
  const count = Object.keys(state.recommendations).length;
  assert.equal(count, 4);
  const settledRevision = state.revision;
  await delay(1700);
  assert.equal(sse.latest()?.revision, settledRevision);
  assert.equal(Object.keys(sse.latest()!.recommendations).length, count);

  const pending = await command({ type: "create_manual_call", location, facts: {} });
  assert.ok(pending.ok && pending.createdId);
  const pendingId = pending.createdId;
  await waitFor("saved pending and ready calls", () => {
    if (!existsSync(snapshotPath)) return;
    const saved = DispatchState.parse(JSON.parse(readFileSync(snapshotPath, "utf8")));
    if (!saved.calls[pendingId]) return;
    assert.equal(saved.calls[pendingId].recommendationSetId, null);
    assert.equal(saved.calls[id].recommendationSetId, readyId);
    return true;
  });
  return { id, readyId, pendingId };
}

async function main() {
  assert.ok(!existsSync(snapshotPath) && !existsSync(`${snapshotPath}.tmp`),
    "Use a disposable worktree with no existing state snapshot.");
  const first = await startServer();
  let second: Awaited<ReturnType<typeof startServer>> | undefined;
  try {
    const sse = await connect();
    let saved: Awaited<ReturnType<typeof checkHooksAndSave>>;
    try {
      await checkFlow(sse);
      saved = await checkHooksAndSave(sse);
    } finally {
      await sse.close();
      await first.stop();
    }
    second = await startServer();
    const restored = await connect();
    try {
      const { id, readyId, pendingId } = saved;
      const state = await restored.wait("restored ready and pending calls refreshed", (snapshot) => {
        const ready = recommendation(snapshot, snapshot.calls[id]);
        const pending = recommendation(snapshot, snapshot.calls[pendingId]);
        return ready?.status === "ready" && ready.id !== readyId && pending?.status === "needs_more_info";
      });
      assert.equal(state.recommendations[readyId].status, "stale");
      assert.deepEqual(recommendation(state, state.calls[pendingId])?.missingFields, ["chiefComplaint"]);
    } finally {
      await restored.close();
    }
    console.log("Address, voice, deduplication, failed-command, and restart hooks passed.");
  } finally {
    await first.stop();
    await second?.stop();
    rmSync(snapshotPath, { force: true });
    rmSync(`${snapshotPath}.tmp`, { force: true });
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
