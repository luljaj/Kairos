"use client";

import { useEffect, useRef, useState } from "react";
import {
  type CommandInput,
  sendCommand,
  useDispatchState,
} from "./useDispatchState";
import { selectedCall, selectedCandidate } from "./dispatch-view";
import { createCommandRunner, type CommandAction } from "./command-action";
import { FLEET_DEMO_SCENARIOS, fleetDemoScenario } from "@/lib/demo/scenarios";
import { RANDOM_INCIDENT_OPTIONS, randomIncidentOption } from "@/lib/demo/random-incidents";
import { PREMADE_INCIDENTS } from "@/lib/demo/premade-incidents";

type Operation = {
  status: "pending" | "uncertain" | "acknowledged" | "error";
  action?: CommandAction;
  revision?: number;
  message: string;
};
export const DEMO_SCENARIOS = [
  ...FLEET_DEMO_SCENARIOS,
  { id: "fall-unconscious", label: "Unconscious fall · Incident" },
  { id: "busy-first-call", label: "Kitchen wrist injury · Incident" },
  { id: "breathing-charlie", label: "Breathing difficulty · Incident" },
  ...PREMADE_INCIDENTS,
  ...RANDOM_INCIDENT_OPTIONS,
] as const;

export function useDispatchUi() {
  const stream = useDispatchState();
  const { state, connection } = stream;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [trackedId, setTrackedId] = useState<string | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [demoPending, setDemoPending] = useState(false);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);
  const [demoConversationId, setDemoConversationId] = useState<string | null>(null);
  const [lastHadCalls, setLastHadCalls] = useState(false);
  const runner = useRef(createCommandRunner(sendCommand));
  const demoLock = useRef(false);
  const previousHadCalls = useRef(false);
  const demoCall = demoConversationId
    ? Object.values(state?.calls ?? {}).find((item) => item.conversationId === demoConversationId)
    : null;
  const call = selectedCall(state, demoCall?.id ?? selectedId);
  if (demoCall) {
    setDemoConversationId(null);
    setCandidateId(null);
  }
  const set = call?.recommendationSetId
    ? (state?.recommendations[call.recommendationSetId] ?? null)
    : null;
  const candidate = selectedCandidate(set?.candidates ?? [], demoCall ? null : candidateId);
  const task = call?.taskId ? (state?.tasks[call.taskId] ?? null) : null;
  if (call && selectedId !== call.id) setSelectedId(call.id);
  if (candidate && candidateId !== candidate.ambulanceId)
    setCandidateId(candidate.ambulanceId);
  const hasCalls = !!state && Object.keys(state.calls).length > 0;
  // Reset local presentation only once the authoritative empty snapshot arrives.
  if (state && hasCalls !== lastHadCalls) {
    setLastHadCalls(hasCalls);
    if (!hasCalls) {
      setSelectedId(null);
      setCandidateId(null);
      setTrackedId(null);
      setDemoMessage(null);
      setOperation(null);
    }
  }
  useEffect(() => {
    if (previousHadCalls.current && !hasCalls) runner.current.reset();
    previousHadCalls.current = hasCalls;
  }, [hasCalls]);
  const observed =
    operation?.status === "acknowledged" &&
    !!state &&
    state.revision >= operation.revision!;
  if (observed && operation?.action?.command.type === "reset_demo") {
    setDemoConversationId(null);
    setSelectedId(null);
    setCandidateId(null);
    setTrackedId(null);
    setDemoMessage(null);
    setOperation(null);
  }
  const blocked =
    demoPending ||
    operation?.status === "pending" ||
    operation?.status === "uncertain" ||
    (operation?.status === "acknowledged" && !observed);
  const canAct = connection === "open" && !blocked;

  async function execute(command: CommandInput, retry = false) {
    if (connection !== "open" || (!retry && !canAct)) return;
    setOperation({
      status: "pending",
      message: retry ? "Retrying the same command…" : "Sending command…",
    });
    const outcome = await runner.current.run(command, retry);
    if (!outcome) return;
    const { result, action } = outcome;
    if (!result) {
      setOperation({
        status: "uncertain",
        action,
        message:
          "No acknowledgement received. Retry this same action to check its outcome safely.",
      });
    } else if (!result.ok) {
      setOperation({
        status: "error",
        action,
        message: `${result.error}: ${result.message}`,
      });
    } else {
      setOperation({
        status: "acknowledged",
        action,
        revision: result.revision,
        message: "Acknowledged. Waiting for the backend snapshot…",
      });
    }
  }

  async function startDemo(scenario: string) {
    if (!canAct || demoLock.current) return;
    demoLock.current = true;
    setDemoPending(true);
    setDemoMessage(null);
    try {
      const response = await fetch("/api/demo/scripted-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
        signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json();
      if (
        !response.ok ||
        !result.ok ||
        typeof result.conversationId !== "string"
      )
        throw new Error();
      setDemoConversationId(result.conversationId);
      setDemoMessage(
        fleetDemoScenario(scenario)
          ? "Fleet staged. A new sample call is incoming. Clear returns all units to the squad room."
          : randomIncidentOption(scenario)
            ? "Random incidents started. Existing calls and assignments are preserved. Clear cancels remaining arrivals."
            : "Scripted demo started. Incident updates will appear as the scenario progresses.",
      );
    } catch {
      setDemoMessage(
        "Could not confirm the demo start. Check the queue before starting another incident.",
      );
    } finally {
      demoLock.current = false;
      setDemoPending(false);
    }
  }

  return {
    ...stream,
    call,
    set,
    candidate,
    task,
    canAct,
    demoPending,
    demoMessage,
    trackedId: trackedId && state?.ambulances[trackedId] ? trackedId : null,
    setTrackedId,
    selectCall: (id: string) => {
      setSelectedId(id);
      setCandidateId(null);
    },
    selectCandidate: setCandidateId,
    operation: observed ? null : operation,
    retry: () => operation?.action && execute(operation.action.command, true),
    refresh: () =>
      call && execute({ type: "request_recommendation", callId: call.id }),
    accept: (confirmMismatch = false) =>
      set &&
      candidate &&
      set.status === "ready" &&
      candidate.selectable &&
      !task &&
      execute({
        type: "accept_recommendation",
        recommendationSetId: set.id,
        ambulanceId: candidate.ambulanceId,
        confirmMismatch,
      }),
    reset: () => execute({ type: "reset_demo" }),
    startDemo,
  };
}
export type DispatchUiState = ReturnType<typeof useDispatchUi>;
