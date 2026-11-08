"use client";

/**
 * Local mock for the dashboard: simulated fleet, scripted call and triage options.
 * Unwired — swap for useDispatchState() (SSE) and sendCommand() when the backend is ready.
 */

import { useCallback, useState } from "react";
import { TRIAGE, unitById } from "./data";
import { useDispatchSim } from "./sim";

/** Shared operator state every variant drives: sim, triage choice, tracking. */
export function useDispatchUi() {
  const sim = useDispatchSim();
  const [trackedId, setTrackedId] = useState<string | null>(null);
  const [index, setIndexRaw] = useState(0);
  const [dir, setDir] = useState(1);
  const [sent, setSent] = useState<{ unitId: string; queued: boolean } | null>(null);
  const [selectedCallId, setSelectedCallId] = useState("call-0412");

  const setIndex = useCallback(
    (i: number) => {
      setDir(i > index || (index === TRIAGE.length - 1 && i === 0) ? 1 : -1);
      setIndexRaw(i);
      setTrackedId(null);
    },
    [index],
  );

  const { dispatch } = sim;
  const send = useCallback(() => {
    const o = TRIAGE[index];
    dispatch(o.unitId, o.routeKey);
    setSent({ unitId: o.unitId, queued: o.verdict === "queued" });
  }, [index, dispatch]);

  const track = useCallback((id: string | null) => setTrackedId((cur) => (cur === id ? null : id)), []);

  const proposal = sent ? null : TRIAGE[index];
  const assignedLabel = sent
    ? `${unitById(sent.unitId).name} ${sent.queued ? "queued" : "en route"}`
    : undefined;

  return {
    sim,
    trackedId,
    track,
    setTrackedId,
    index,
    dir,
    setIndex,
    option: TRIAGE[index],
    proposal,
    sent,
    send,
    assignedLabel,
    selectedCallId,
    setSelectedCallId,
  };
}

export type DispatchUiState = ReturnType<typeof useDispatchUi>;
