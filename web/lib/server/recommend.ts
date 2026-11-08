import { RecommendationSet, type Candidate, type DispatchState, type MissingField,
  type ModelRequest, type ModelResponse } from "@/lib/contracts";
import { buildCandidates, buildModelRequest, capabilityMismatch, fleetInputKey, incidentInputKey,
  sortForDisplay } from "./candidates";
import { fallbackResponse, mockResponse } from "./fallback";
import { markRecommendationStale } from "./incidents";
import { createModelClient, loadModelConfig, ModelFailure, validateModelResponse, type Inference,
  type ModelConfig } from "./model";
import { getState, mutate, newId, touch } from "./store";

const DEBOUNCE_MS = 1500;
const SOFT_MS = 4000;
const HARD_MS = 8000;

type Timer = ReturnType<typeof setTimeout>;
type Ticket = {
  callId: string;
  token: number;
  generation: number;
  allowAssigned: boolean;
};
type Snapshot = Ticket & {
  factsRevision: number;
  fleetRevision: number;
  incidentKey: string;
  fleetKey: string;
  taskId: string | null;
  simClock: string;
  candidates: Candidate[];
};
type Job = Snapshot & {
  request: ModelRequest;
  enqueuedAt: number;
  startedAt: number | null;
  controller: AbortController;
  fallbackPublished: boolean;
  timers: Set<Timer>;
};
type Output =
  | { response: ModelResponse; modelId: string | null }
  | { missing: MissingField[] }
  | { error: string };

type Options = {
  store: { getState: typeof getState; mutate: (fn: (state: DispatchState) => boolean) => unknown };
  mode: ModelConfig["mode"];
  infer?: Inference;
  now?: () => number;
  wallTime?: () => string;
  setTimer?: (fn: () => void, ms: number) => Timer;
  clearTimer?: (timer: Timer) => void;
  log?: (category: string, elapsedMs?: number) => void;
};

export function createRecommendationScheduler({
  store, mode, infer, now = () => performance.now(), wallTime = () => new Date().toISOString(),
  setTimer = setTimeout, clearTimer = clearTimeout,
  log = (category, elapsedMs) =>
    console.warn(`[recommend] ${category}${elapsedMs === undefined ? "" : ` after ${Math.round(elapsedMs)} ms`}`),
}: Options) {
  let initialized = false;
  let generation = 0;
  let nextToken = 0;
  const tokens = new Map<string, number>();
  const debounce = new Map<string, Timer>();
  const pending = new Map<string, Job>();
  let active: Job | null = null;

  const currentTicket = (ticket: Ticket) =>
    ticket.generation === generation && tokens.get(ticket.callId) === ticket.token;

  function isCurrent(job: Snapshot, state: DispatchState): boolean {
    const call = state.calls[job.callId];
    const task = call?.taskId ? state.tasks[call.taskId] : null;
    return currentTicket(job) && !!call && call.status !== "closed"
      && call.taskId === job.taskId && (!job.taskId || task?.status === "active" || task?.status === "queued")
      && call.factsRevision === job.factsRevision && state.fleetRevision === job.fleetRevision
      && incidentInputKey(call) === job.incidentKey && fleetInputKey(state) === job.fleetKey;
  }

  function publish(job: Snapshot, output: Output, latencyMs: number): boolean {
    let applied = false;
    store.mutate((state) => {
      if (!isCurrent(job, state)) return false;
      const call = state.calls[job.callId];
      const response = "response" in output ? output.response : null;
      const ready = response?.status === "ready" ? response : null;
      const status = "error" in output ? "error" : response?.status ?? "needs_more_info";
      const modelId = "modelId" in output ? output.modelId : null;
      const source = modelId === null ? "fallback" : "model";
      const effectiveAcuity = call.acuity?.source === "dispatcher" ? call.acuity.value : ready?.acuity ?? null;
      const createdAt = wallTime();
      const summary = "error" in output ? output.error
        : "missing" in output
          ? `Confirm the ${output.missing.map((field) => field === "location" ? "incident location" : "chief complaint").join(" and ")}.`
          : output.response.status === "ready" ? output.response.summary : output.response.reason;
      const set = RecommendationSet.parse({
        id: newId("rec"),
        callId: job.callId,
        factsRevision: job.factsRevision,
        fleetRevision: job.fleetRevision,
        createdAt,
        source,
        modelId,
        status,
        acuityReason: ready?.acuityReason ?? null,
        acuity: ready?.acuity ?? null,
        summary,
        missingFields: "missing" in output ? output.missing
          : response?.status === "needs_more_info" ? response.missingFields : [],
        recommendedAmbulanceId: ready?.recommendedAmbulanceId ?? null,
        candidates: sortForDisplay(job.candidates.map((candidate) => {
          const judgment = ready?.candidates.find((c) => c.ambulanceId === candidate.ambulanceId);
          return {
            ...candidate,
            capabilityMismatch: capabilityMismatch(candidate.careLevel, effectiveAcuity),
            crewSuitable: judgment?.crewSuitable ?? null,
            reason: judgment?.reason ?? null,
          };
        })),
        latencyMs,
      });

      if (!call.taskId) {
        call.status = status === "needs_more_info" ? "intake" : "awaiting_decision";
        call.summary = set.summary;
        if (call.acuity?.source !== "dispatcher") {
          call.acuity = ready ? { value: ready.acuity, source, setAt: createdAt } : null;
        }
      }
      markRecommendationStale(state, call);
      state.recommendations[set.id] = set;
      call.recommendationSetId = set.id;
      touch(call, createdAt);
      applied = true;
      return true;
    });
    return applied;
  }

  function publishFallback(job: Job, latencyMs = 0) {
    if (job.fallbackPublished || !isCurrent(job, store.getState())) return;
    const respond = mode === "mock" ? mockResponse : fallbackResponse;
    try {
      const response = validateModelResponse(job.request, respond(job.request));
      job.fallbackPublished = publish(job, { response, modelId: null }, latencyMs);
    } catch {
      log("invalid local recommendation");
      job.fallbackPublished = publish(job, { error: "Could not generate a recommendation." }, latencyMs);
    }
  }

  function addTimer(job: Job, fn: () => void, ms: number) {
    const timer = setTimer(() => {
      job.timers.delete(timer);
      fn();
    }, ms);
    job.timers.add(timer);
  }

  function clearTimers(job: Job) {
    for (const timer of job.timers) clearTimer(timer);
    job.timers.clear();
  }

  function releaseTicket(ticket: Ticket) {
    if (currentTicket(ticket)) tokens.delete(ticket.callId);
  }

  function finish(job: Job) {
    clearTimers(job);
    releaseTicket(job);
    if (active !== job) return;
    active = null;
    drain();
  }

  function hardDeadline(job: Job) {
    if (active !== job) return;
    log("hard deadline", job.startedAt === null ? undefined : now() - job.startedAt);
    publishFallback(job, now() - job.enqueuedAt);
    job.controller.abort();
    finish(job);
  }

  async function run(job: Job, invoke: Inference, startedAt: number) {
    try {
      const result = await invoke(job.request, job.controller.signal);
      if (active !== job || !isCurrent(job, store.getState())) return;
      if (now() - startedAt >= HARD_MS) {
        hardDeadline(job);
        return;
      }
      const response = validateModelResponse(job.request, result.response);
      publish(job, { response, modelId: result.modelId }, result.latencyMs);
    } catch (error) {
      if (active === job && isCurrent(job, store.getState())) {
        const category = error instanceof ModelFailure ? error.category : "internal";
        log(error instanceof ModelFailure && error.httpStatus ? `${category} ${error.httpStatus}` : category,
          now() - startedAt);
        publishFallback(job, now() - job.enqueuedAt);
      }
    } finally {
      finish(job);
    }
  }

  function drain() {
    if (active || !infer) return;
    for (const [id, job] of pending) {
      pending.delete(id);
      clearTimers(job);
      if (!isCurrent(job, store.getState())) {
        releaseTicket(job);
        continue;
      }
      active = job;
      job.startedAt = now();
      addTimer(job, () => publishFallback(job, now() - job.enqueuedAt), SOFT_MS);
      addTimer(job, () => hardDeadline(job), HARD_MS);
      void run(job, infer, job.startedAt);
      break;
    }
  }

  function enqueue(ticket: Ticket) {
    if (!currentTicket(ticket)) return;
    const state = store.getState();
    const call = state.calls[ticket.callId];
    if (!call || call.status === "closed" || (call.taskId && !ticket.allowAssigned)) {
      releaseTicket(ticket);
      return;
    }
    const missing: MissingField[] = [];
    if (!call.location.coords) missing.push("location");
    if (!call.facts.chiefComplaint?.trim()) missing.push("chiefComplaint");
    const snapshot: Snapshot = {
      ...ticket, factsRevision: call.factsRevision, fleetRevision: state.fleetRevision,
      incidentKey: incidentInputKey(call), fleetKey: fleetInputKey(state),
      taskId: call.taskId, simClock: state.simClock, candidates: buildCandidates(state, call),
    };
    if (missing.length || !snapshot.candidates.some((c) => c.selectable)) {
      publish(snapshot, missing.length ? { missing } : { error: "No selectable ambulances are available." }, 0);
      releaseTicket(ticket);
      return;
    }
    let request: ModelRequest;
    try {
      request = buildModelRequest(state, call, snapshot.candidates, newId("req"));
    } catch {
      log("invalid model request");
      publish(snapshot, { error: "Could not prepare a recommendation." }, 0);
      releaseTicket(ticket);
      return;
    }
    const job: Job = {
      ...snapshot, request, enqueuedAt: now(), startedAt: null, controller: new AbortController(),
      fallbackPublished: false, timers: new Set(),
    };
    if (mode !== "model" || !infer) {
      publishFallback(job);
      releaseTicket(ticket);
      return;
    }
    pending.set(ticket.callId, job);
    addTimer(job, () => publishFallback(job, now() - job.enqueuedAt), SOFT_MS);
    drain();
  }

  function discardCall(callId: string) {
    tokens.delete(callId);
    const timer = debounce.get(callId);
    if (timer !== undefined) clearTimer(timer);
    debounce.delete(callId);
    const job = pending.get(callId);
    if (job) clearTimers(job);
    pending.delete(callId);
    if (active?.callId === callId) {
      clearTimers(active);
      active.controller.abort();
      active = null;
    }
  }

  function schedule(callId: string, { immediate = false } = {}) {
    const call = store.getState().calls[callId];
    if (!call || call.status === "closed" || (call.taskId && !immediate)) return;

    discardCall(callId);
    const ticket = { callId, token: ++nextToken, generation, allowAssigned: immediate };
    tokens.set(callId, ticket.token);
    store.mutate((state) => markRecommendationStale(state, state.calls[callId]));
    if (immediate) {
      enqueue(ticket);
    } else {
      debounce.set(callId, setTimer(() => {
        if (!currentTicket(ticket)) return;
        debounce.delete(callId);
        enqueue(ticket);
      }, DEBOUNCE_MS));
    }
    drain();
  }

  function scheduleAwaiting() {
    for (const call of Object.values(store.getState().calls)) schedule(call.id);
  }

  return {
    ensureStarted() {
      if (initialized) return;
      initialized = true;
      scheduleAwaiting();
    },
    schedule,
    scheduleAwaiting,
    cancel(callId: string) {
      discardCall(callId);
      drain();
    },
    reset() {
      generation++;
      for (const callId of tokens.keys()) discardCall(callId);
      initialized = false;
    },
  };
}

declare global {
  var __recommendations: ReturnType<typeof createRecommendationScheduler> | undefined;
}

function createRuntimeScheduler() {
  const store = { getState, mutate };
  try {
    const config = loadModelConfig(process.env);
    const client = createModelClient(config);
    if (client.promptHash) console.info(`[recommend] loaded prompt sha256 ${client.promptHash}`);
    return createRecommendationScheduler({ store, mode: config.mode, infer: client.infer });
  } catch {
    console.warn("[recommend] model configuration or assets invalid; using fallback");
    return createRecommendationScheduler({ store, mode: "fallback" });
  }
}

const scheduler = () => globalThis.__recommendations ??= createRuntimeScheduler();
export const ensureRecommendationsStarted = () => scheduler().ensureStarted();
export const scheduleRecommendation = (callId: string, options?: { immediate?: boolean }) =>
  scheduler().schedule(callId, options);
export const scheduleAwaitingRecommendations = () => scheduler().scheduleAwaiting();
export const cancelCallRecommendation = (callId: string) => scheduler().cancel(callId);
export const resetRecommendations = () => globalThis.__recommendations?.reset();
