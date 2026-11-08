import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import {
  DispatchState, ModelRequest, EMPTY_FACTS, type Call, type IncidentFacts, type ModelResponse, type Task,
} from "@/lib/contracts";
import { buildCandidates, buildModelRequest, fleetInputKey, incidentInputKey } from "@/lib/server/candidates";
import { estimateArrival, estimateAvailability, estimateTravelSeconds, nearestHospital } from "@/lib/server/eta";
import { fallbackResponse, mockResponse } from "@/lib/server/fallback";
import { initialState, scenarios } from "@/lib/server/fixtures";
import { createCall } from "@/lib/server/incidents";
import { createModelClient, loadModelConfig, ModelFailure, validateModelResponse, type Inference } from "@/lib/server/model";
import { createRecommendationScheduler } from "@/lib/server/recommend";

const epoch = "2026-11-07T22:00:00.000Z";
const stateFixture = () => initialState(new Date(epoch));
const addCall = (state: DispatchState, facts?: Partial<IncidentFacts>) => createCall(state, {
  now: epoch, location: scenarios["fall-unconscious"].location,
  facts: { chiefComplaint: "Slipped and hurt wrist", conscious: true, breathingNormally: true, ...facts },
});
const requestFor = (state: DispatchState, call: Call) =>
  buildModelRequest(state, call, buildCandidates(state, call), "test-request");

function checkEtaAndCandidates() {
  const state = stateFixture();
  const call = addCall(state);
  const unit = state.ambulances["amb-2"];
  const travel = () => 60;
  assert.equal(estimateTravelSeconds({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }), 14011);
  assert.equal(estimateTravelSeconds(unit.position, unit.position), 0);
  assert.equal(estimateAvailability(state, unit).availableInSeconds, 0);

  function addTask(id: string, status: Task["status"]): Task {
    const task: Task = {
      id, revision: 0, callId: addCall(state).id, ambulanceId: unit.id, status,
      phase: status === "active" ? "en_route" : null,
      phaseEndsAt: status === "active" ? "2026-11-07T22:00:30.000Z" : null,
      route: null, hospital: null, etaAt: null, acceptedFromRecommendationId: null,
      override: null, acuityAtAcceptance: null, createdAt: epoch, updatedAt: epoch,
    };
    state.tasks[id] = task;
    return task;
  }

  const active = addTask("task-active", "active");
  const queued = addTask("task-queued", "queued");
  unit.status = "busy";
  unit.activeTaskId = active.id;
  unit.queuedTaskIds = [queued.id];
  assert.deepEqual(estimateArrival(state, unit, call.location.coords, travel), {
    availableInSeconds: 1170, travelSeconds: 60, arrivalInSeconds: 1230,
  });
  const another = addTask("task-another", "queued");
  another.hospital = state.hospitals[1];
  unit.queuedTaskIds.push(another.id);
  assert.deepEqual(estimateAvailability(state, unit, travel), {
    availableInSeconds: 1770, releasePoint: another.hospital.coords,
  });
  unit.queuedTaskIds = [];
  active.phase = "on_scene";
  assert.equal(estimateAvailability(state, unit, travel).availableInSeconds, 90);
  active.phaseEndsAt = null;
  assert.equal(estimateAvailability(state, unit, travel).availableInSeconds, 540);
  active.route = { durationSeconds: 75, distanceMeters: 0, geometry: [], estimated: false };
  active.phase = "en_route";
  assert.equal(estimateAvailability(state, unit, travel).availableInSeconds, 615);
  active.phase = "transporting";
  assert.equal(estimateAvailability(state, unit, travel).availableInSeconds, 75);
  active.phaseEndsAt = "2026-11-07T21:59:59.000Z";
  assert.equal(estimateAvailability(state, unit, travel).availableInSeconds, 0);
  active.phase = null;
  assert.equal(estimateAvailability(state, unit, travel).availableInSeconds, null);
  active.phase = "en_route";
  unit.activeTaskId = "task-missing";
  assert.equal(estimateAvailability(state, unit, travel).availableInSeconds, null);
  unit.activeTaskId = active.id;
  unit.queuedTaskIds = [queued.id, queued.id];
  assert.equal(estimateAvailability(state, unit, travel).availableInSeconds, null);
  unit.queuedTaskIds = [queued.id];
  queued.ambulanceId = "amb-1";
  assert.equal(estimateAvailability(state, unit, travel).availableInSeconds, null);
  unit.queuedTaskIds = [];
  state.calls[active.callId].location.coords = null;
  assert.equal(estimateAvailability(state, unit, travel).availableInSeconds, null);
  state.calls[active.callId].location.coords = call.location.coords;
  assert.equal(estimateArrival(state, unit, call.location.coords, () => Infinity).arrivalInSeconds, null);

  const point = { lat: 1, lng: 1 };
  state.hospitals = [
    { id: "hosp-z", name: "Z", coords: point },
    { id: "hosp-a", name: "A", coords: point },
  ];
  assert.equal(nearestHospital(state, point)?.name, "A");
  state.hospitals = [];
  assert.equal(estimateAvailability(state, unit, travel).availableInSeconds, null);

  state.ambulances["amb-1"].crewIds = [];
  const candidates = buildCandidates(state, call);
  assert.equal(candidates.length, 3);
  assert.equal(candidates[2].unavailableReason, "Crew incomplete");
  assert.equal(candidates[2].availableInSeconds, null);
  const request = requestFor(state, call);
  assert.deepEqual(request.candidates.map((c) => c.ambulanceId), ["amb-3", "amb-2"]);
  assert.equal(request.candidates[1].arrivalInSeconds, null);
  assert.deepEqual(Object.keys(request.candidates[0].crew[0]), ["role", "qualifications", "monthsOfService"]);

  const before = incidentInputKey(call);
  call.transcript.push({ text: "caller", role: "caller", at: epoch });
  call.summary = "Updated";
  assert.equal(incidentInputKey(call), before);
  call.location.confidence = "approximate";
  assert.notEqual(incidentInputKey(call), before);
  const fleet = fleetInputKey(state);
  state.simClock = "2026-11-07T22:00:30.000Z";
  state.crew["crew-2a"].name = "New name";
  assert.equal(fleetInputKey(state), fleet);
  state.calls[active.callId].location.coords = point;
  assert.notEqual(fleetInputKey(state), fleet);
}

function checkFallback() {
  const state = stateFixture();
  const call = addCall(state);
  const request = requestFor(state, call);
  function assess(facts: Partial<IncidentFacts>) {
    const input = { ...request, incident: { ...request.incident, facts: { ...EMPTY_FACTS, ...facts } } };
    return validateModelResponse(input, fallbackResponse(input));
  }
  const chiefComplaint = "Father fell down the stairs, not answering";
  const waiting = assess({ chiefComplaint });
  assert.equal(waiting.status, "needs_more_info");
  assert.deepEqual(waiting.missingFields, ["conscious", "breathingNormally"]);
  assert.equal(assess({ chiefComplaint, conscious: false, breathingNormally: true }).acuity, "Delta");
  assert.equal(assess({ chiefComplaint, conscious: false, breathingNormally: false }).acuity, "Echo");
  assert.equal(assess({ chiefComplaint: "Asthma, short of breath", conscious: true, breathingNormally: false }).acuity, "Charlie");
  assert.equal(assess({ chiefComplaint: "Slipped and hurt wrist", conscious: true, breathingNormally: true }).acuity, "Bravo");
  assert.equal(assess({ chiefComplaint: "sore throat", conscious: true, breathingNormally: true }).acuity, "Alpha");
  assert.equal(assess({ chiefComplaint: "not well" }).status, "needs_more_info");

  const unknown = ModelRequest.parse({
    ...request, incident: { ...request.incident, facts: { ...call.facts, conscious: false } },
    candidates: [...request.candidates].reverse().map((c) => ({
      ...c, careLevel: "BLS", travelSeconds: null, arrivalInSeconds: null,
    })),
  });
  const answer = fallbackResponse(unknown);
  assert.equal(answer.status, "ready");
  assert.equal(answer.recommendedAmbulanceId, "amb-1");
  assert.ok(answer.candidates.every((c) => !c.crewSuitable && c.reason.includes("Arrival estimate unavailable")));
  assert.deepEqual(mockResponse(unknown), answer);

  // Build the oracle offline with the baseline, even for cases whose training gold differs.
  const modelDir = path.resolve(process.env.RUBRIC_MODEL_DIR ?? "../model");
  const oracle = execFileSync("python3", ["-B", "-c", `
import json, pathlib, sys
base = pathlib.Path(sys.argv[1])
sys.path.insert(0, str(base))
from rubric import label
for line in (base / "fixtures/demo/demo.jsonl").read_text().splitlines():
    row = json.loads(line)
    req = json.loads(next(m["content"] for m in row["messages"] if m["role"] == "user"))
    print(json.dumps([req, label(req, use_experience_exception=False)]))
`, modelDir], { encoding: "utf8" }).trim().split("\n");
  assert.ok(oracle.length > 0);
  for (const row of oracle) {
    const [input, expected] = JSON.parse(row);
    const req = ModelRequest.parse(input);
    const result = validateModelResponse(req, fallbackResponse(req));
    assert.equal(result.status, expected.status);
    assert.equal(result.acuity, expected.acuity);
    if (result.status === "needs_more_info") assert.deepEqual(result.missingFields, expected.missingFields);
    else {
      assert.equal(result.recommendedAmbulanceId, expected.recommendedAmbulanceId);
      assert.deepEqual(Object.fromEntries(result.candidates.map((c) => [c.ambulanceId, c.crewSuitable])), expected.suitable);
    }
  }
  console.log(`Fallback parity passed for ${oracle.length} baseline requests.`);
}

function harness(mode: "model" | "mock" | "fallback" = "model", customInfer?: Inference) {
  const state = stateFixture();
  let time = 0;
  let nextTimer = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  const calls: {
    request: ModelRequest; signal: AbortSignal; resolve: (result: Awaited<ReturnType<Inference>>) => void;
  }[] = [];
  const logs: string[] = [];
  const scheduler = createRecommendationScheduler({
    store: {
      getState: () => state,
      mutate: (fn) => {
        if (fn(state)) state.revision++;
        DispatchState.parse(state);
      },
    },
    mode,
    infer: customInfer ?? ((request, signal) => new Promise((resolve) => { calls.push({ request, signal, resolve }); })),
    now: () => time,
    wallTime: () => new Date(Date.parse(epoch) + time).toISOString(),
    setTimer: (run, ms) => {
      timers.set(++nextTimer, { at: time + ms, run });
      return nextTimer as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: (timer) => { timers.delete(timer as unknown as number); },
    log: (category) => logs.push(category),
  });
  return {
    scheduler, state, calls, timers, logs,
    latest: (call: Call) => call.recommendationSetId ? state.recommendations[call.recommendationSetId] : null,
    tick(ms: number) {
      const end = time + ms;
      while (true) {
        const next = [...timers].sort(([, a], [, b]) => a.at - b.at)[0];
        if (!next || next[1].at > end) break;
        time = next[1].at;
        timers.delete(next[0]);
        next[1].run();
      }
      time = end;
    },
    async resolve(index: number, response?: ModelResponse) {
      const { request, resolve } = calls[index];
      resolve({ response: response ?? fallbackResponse(request), modelId: "stub-model", latencyMs: 45 });
      await Promise.resolve();
    },
  };
}

async function checkScheduler() {
  {
    const h = harness();
    const call = addCall(h.state);
    h.scheduler.schedule(call.id, { immediate: true });
    h.tick(1000);
    call.facts.chiefComplaint = "sore throat";
    call.factsRevision++;
    h.scheduler.schedule(call.id);
    assert.ok(h.calls[0].signal.aborted);
    h.tick(1499);
    assert.equal(h.calls.length, 1);
    h.tick(1);
    await h.resolve(1);
    const latest = h.latest(call);
    await h.resolve(0);
    assert.equal(h.latest(call), latest);
    assert.equal(latest?.acuity, "Alpha");
  }
  {
    const h = harness();
    const first = addCall(h.state);
    const second = addCall(h.state);
    h.scheduler.schedule(first.id, { immediate: true });
    h.scheduler.schedule(second.id, { immediate: true });
    assert.equal(h.calls.length, 1);
    h.tick(4000);
    const fallback = h.latest(first);
    const waitingFallback = h.latest(second);
    assert.equal(fallback?.source, "fallback");
    assert.equal(fallback.latencyMs, 4000);
    assert.equal(waitingFallback?.source, "fallback");
    h.tick(1000);
    await h.resolve(0);
    assert.equal(h.latest(first)?.source, "model");
    assert.equal(fallback.status, "stale");
    assert.equal(h.calls.length, 2);
    h.tick(4000);
    assert.equal(h.latest(second), waitingFallback);
    h.tick(4000);
    assert.ok(h.calls[1].signal.aborted);
    h.tick(1000);
    await h.resolve(1);
    assert.equal(h.latest(second), waitingFallback);
    assert.equal(h.timers.size, 0);
  }
  {
    const h = harness();
    const first = addCall(h.state);
    const second = addCall(h.state);
    h.scheduler.schedule(first.id, { immediate: true });
    h.scheduler.schedule(second.id, { immediate: true });
    h.tick(1000);
    h.scheduler.reset();
    assert.ok(h.calls[0].signal.aborted);
    assert.equal(h.timers.size, 0);
    h.tick(9000);
    await h.resolve(0);
    assert.deepEqual(h.state.recommendations, {});
    h.scheduler.ensureStarted();
    h.tick(1500);
    assert.equal(h.calls.length, 2);
    assert.equal(h.calls[1].request.incident.facts.chiefComplaint, first.facts.chiefComplaint);
  }
  {
    const h = harness();
    const call = addCall(h.state);
    h.scheduler.schedule(call.id, { immediate: true });
    h.tick(4000);
    const fallback = h.latest(call);
    call.taskId = "task-assigned";
    call.status = "assigned";
    h.state.tasks[call.taskId] = {
      id: call.taskId, callId: call.id, ambulanceId: "amb-1", revision: 0, status: "active",
      phase: "en_route", createdAt: epoch, updatedAt: epoch, phaseEndsAt: null, hospital: null, route: null,
      etaAt: null, acuityAtAcceptance: "Bravo", acceptedFromRecommendationId: fallback?.id ?? null, override: null,
    };
    await h.resolve(0);
    assert.equal(h.latest(call), fallback);
    const accepted = { ...call };
    const task = structuredClone(h.state.tasks[call.taskId]);
    h.scheduler.schedule(call.id, { immediate: true });
    await h.resolve(1);
    assert.equal(h.latest(call)?.source, "model");
    for (const field of ["acuity", "summary", "status", "taskId"] as const) assert.equal(call[field], accepted[field]);
    assert.deepEqual(h.state.tasks[call.taskId], task);
    h.scheduler.schedule(call.id, { immediate: true });
    h.state.tasks[call.taskId].status = "completed";
    const advisory = h.latest(call);
    await h.resolve(2);
    assert.equal(h.latest(call), advisory);
  }
  {
    const h = harness();
    const call = addCall(h.state);
    h.scheduler.schedule(call.id, { immediate: true });
    call.acuity = { value: "Delta", source: "dispatcher", setAt: epoch };
    h.state.simClock = "2026-11-07T22:00:05.000Z";
    await h.resolve(0);
    assert.equal(h.latest(call)?.acuity, "Bravo");
    assert.equal(call.acuity.value, "Delta");
    const bls = h.latest(call)?.candidates.at(-1);
    assert.equal(bls?.capabilityMismatch, true);
    assert.equal(bls.crewSuitable, true);
    h.scheduler.schedule(call.id, { immediate: true });
    call.location.text = "New address";
    await h.resolve(1);
    assert.equal(h.latest(call)?.status, "stale");
  }
  for (const mode of ["mock", "fallback"] as const) {
    const h = harness(mode);
    const call = addCall(h.state, { chiefComplaint: " " });
    call.location.coords = null;
    h.scheduler.schedule(call.id, { immediate: true });
    assert.deepEqual(h.latest(call)?.missingFields, ["location", "chiefComplaint"]);
    call.location.coords = scenarios["fall-unconscious"].location.coords;
    call.facts.chiefComplaint = "Slipped";
    for (const unit of Object.values(h.state.ambulances)) unit.status = "out_of_service";
    h.scheduler.schedule(call.id, { immediate: true });
    assert.equal(h.latest(call)?.status, "error");
    assert.equal(h.latest(call)?.candidates.length, 3);
    h.state.ambulances["amb-1"].status = "available";
    h.scheduler.schedule(call.id, { immediate: true });
    assert.equal(h.latest(call)?.status, "ready");
    assert.equal(h.latest(call)?.modelId, null);
    assert.equal(h.calls.length, 0);
  }
  console.log("Scheduler timing, cancellation, freshness, and publication checks passed.");
}

async function checkTransport() {
  const state = stateFixture();
  const req = requestFor(state, addCall(state));
  const answer = fallbackResponse(req);
  assert.equal(answer.status, "ready");
  const content = JSON.stringify(answer);
  const reply = (value: unknown, finish = "stop", refusal: string | null = null) => ({
    model: "reported-base-model", choices: [{ finish_reason: finish, message: { content: value, refusal } }],
  });
  let body = reply(content);
  let status = 200;
  const sent: { path?: string; auth?: string; body: Record<string, unknown> }[] = [];
  let notifyRequest: (() => void) | null = null;
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    sent.push({ path: req.url, auth: req.headers.authorization, body: JSON.parse(Buffer.concat(chunks).toString()) });
    if (notifyRequest) {
      notifyRequest();
      return; // Leave this request open until the client's signal aborts it.
    }
    res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const env = { NODE_ENV: "test" as const, MODEL_MODE: "model", MODEL_BASE_URL: `http://127.0.0.1:${address.port}/v1///`, MODEL_NAME: "configured-adapter" };
    const compatible = createModelClient(loadModelConfig(env));
    const signal = new AbortController().signal;
    const prompt = readFileSync("../model/prompt.md", "utf8").trim();
    const schema = readFileSync("../model/schemas/model-response.json", "utf8");
    assert.equal(compatible.promptHash, createHash("sha256").update(prompt).digest("hex"));
    assert.equal((await compatible.infer(req, signal)).modelId, "reported-base-model");
    assert.deepEqual(sent[0], {
      path: "/v1/chat/completions", auth: undefined,
      body: {
        model: env.MODEL_NAME, temperature: 0, max_tokens: 600,
        messages: [{ role: "system", content: prompt }, { role: "user", content: JSON.stringify(req) }],
        response_format: { type: "json_schema", json_schema: {
          name: "ModelResponse", schema: JSON.parse(schema, (key, value) => key === "uniqueItems" ? undefined : value),
        } },
      },
    });
    assert.ok(schema.includes('"uniqueItems"'));
    const schemaText = JSON.stringify(sent[0].body.response_format);
    assert.ok(schemaText.indexOf('"acuityReason"') < schemaText.indexOf('"acuity"'));

    for (const format of ["text", "json_object"] as const) {
      const client = createModelClient(loadModelConfig({ ...env, MODEL_RESPONSE_FORMAT: format }));
      await client.infer(req, signal);
      assert.deepEqual(sent.at(-1)?.body.response_format, format === "text" ? undefined : { type: "json_object" });
    }

    const openAI = createModelClient(loadModelConfig({ ...env, MODEL_PROVIDER: "openai", MODEL_API_KEY: "stub-key" }));
    body = reply(JSON.stringify({ result: answer }));
    assert.deepEqual((await openAI.infer(req, signal)).response, answer);
    const openAIRequest = sent.at(-1);
    assert.equal(openAIRequest?.auth, "Bearer stub-key");
    assert.equal(openAIRequest.body.max_completion_tokens, 2048);
    assert.equal(openAIRequest.body.temperature, undefined);
    const strict = openAIRequest.body.response_format as {
      type: string; json_schema: { strict: boolean; schema: {
        additionalProperties: boolean; required: string[];
        properties: { result: { anyOf: { properties: Record<string, unknown>; required: string[]; additionalProperties: boolean }[] } };
      } };
    };
    assert.equal(strict.json_schema.strict, true);
    assert.equal(strict.json_schema.schema.additionalProperties, false);
    assert.deepEqual(strict.json_schema.schema.required, ["result"]);
    const variants = strict.json_schema.schema.properties.result.anyOf;
    assert.equal(variants.length, 2);
    assert.equal(variants[0].additionalProperties, false);
    assert.ok(variants[0].required.includes("acuityReason"));
    assert.deepEqual(Object.keys(variants[0].properties).slice(0, 3), ["status", "acuityReason", "acuity"]);
    assert.match(JSON.stringify(openAIRequest.body.messages), /complete response object inside/);
    assert.throws(() => loadModelConfig({ ...env, MODEL_PROVIDER: "openai" }), ModelFailure);
    assert.throws(() => loadModelConfig({ ...env, MODEL_PROVIDER: "openai", MODEL_API_KEY: "stub-key", MODEL_NAME: "" }), ModelFailure);
    assert.throws(() => loadModelConfig({ ...env, MODEL_PROVIDER: "openai", MODEL_API_KEY: "stub-key", MODEL_RESPONSE_FORMAT: "text" }), ModelFailure);
    assert.throws(() => loadModelConfig({ ...env, MODEL_BASE_URL: "file:///tmp" }), ModelFailure);
    assert.throws(() => loadModelConfig({ ...env, MODEL_MODE: "invalid" }), ModelFailure);
    assert.throws(() => createModelClient(loadModelConfig(env), { modelDir: "/absent" }), ModelFailure);
    assert.equal(createModelClient(loadModelConfig({ NODE_ENV: "test", MODEL_MODE: "mock" }), { modelDir: "/absent" }).promptHash, null);

    const bad = (patch: Partial<typeof answer>) => reply(JSON.stringify({ ...answer, ...patch }));
    const failures: [string, number, ReturnType<typeof reply>][] = [
      ["http 401", 401, reply(content)],
      ["http 429", 429, reply(content)],
      ["http 500", 500, reply(content)],
      ["refusal", 200, reply(content, "stop", "declined")],
      ["truncation", 200, reply(content, "length")],
      ["schema", 200, reply({})],
      ["json", 200, reply("unparseable")],
      ["semantic", 200, bad({ candidates: [...answer.candidates.slice(0, 2), { ...answer.candidates[2], ambulanceId: "amb-unknown" }] })],
      ["semantic", 200, bad({ candidates: [...answer.candidates.slice(0, 2), answer.candidates[0]] })],
      ["semantic", 200, bad({ candidates: answer.candidates.slice(0, 2) })],
      ["semantic", 200, bad({ acuityReason: "This is Echo and requires ALS." })],
    ];
    async function assertFallback(client: Inference, category: string) {
      let done!: () => void;
      const completed = new Promise<void>((resolve) => { done = resolve; });
      let attempts = 0;
      const h = harness("model", async (request, signal) => {
        attempts++;
        try {
          return await client(request, signal);
        } finally {
          done();
        }
      });
      const call = addCall(h.state);
      h.scheduler.schedule(call.id, { immediate: true });
      await completed;
      await Promise.resolve();
      assert.equal(h.latest(call)?.source, "fallback");
      h.tick(12000);
      assert.deepEqual(h.logs, [category]);
      assert.equal(attempts, 1);
      assert.equal(Object.keys(h.state.recommendations).length, 1);
      assert.equal(h.timers.size, 0);
    }
    for (const [category, code, payload] of failures) {
      status = code;
      body = payload;
      await assertFallback(compatible.infer, category);
    }
    const offline = createModelClient(loadModelConfig(env), {
      fetcher: async () => { throw new Error("connection refused"); },
    });
    await assertFallback(offline.infer, "transport");

    const aborted = new AbortController();
    const requestReceived = new Promise<void>((resolve) => { notifyRequest = resolve; });
    const inflight = compatible.infer(req, aborted.signal);
    await requestReceived;
    aborted.abort();
    await assert.rejects(inflight, { category: "transport" });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  console.log("Provider bodies and all fallback failure categories passed against the local HTTP stub.");
}

async function main() {
  checkEtaAndCandidates();
  checkFallback();
  await checkScheduler();
  await checkTransport();
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
