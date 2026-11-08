"use client";

import { useRef, useState } from "react";
import { Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DEMO_SCENARIOS, useDispatchUi } from "@/lib/client/useDispatchUi";
import { callTitle } from "@/lib/client/dispatch-view";
import "./dispatch.css";
import { DispatchMap, type DispatchMapHandle } from "./dispatch-map";
import {
  Mark,
  AcuityMark,
  CallRow,
  FleetRow,
  KeySignals,
  LiveCaption,
  UnitDetail,
} from "./parts";
import { TriageCard } from "./triage-card";

export function DispatchDashboard() {
  const s = useDispatchUi();
  const [scenario, setScenario] = useState<string>(DEMO_SCENARIOS[0].id);
  const mapRef = useRef<DispatchMapHandle>(null);
  const { state, call } = s;
  const tracked = s.trackedId ? state?.ambulances[s.trackedId] : null;
  return (
    <main className="dispatch dark">
      <DispatchMap
        ref={mapRef}
        state={state}
        selectedCallId={call?.id ?? null}
        candidateId={s.task?.ambulanceId ?? s.candidate?.ambulanceId ?? null}
        trackedId={s.trackedId}
        onSelectUnit={s.setTrackedId}
        onSelectCall={s.selectCall}
      />
      <aside className="dispatch-left">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="flex items-center gap-1.5">
            <Mark />
            <span className="text-[15px] font-medium tracking-tight">Kairos</span>
          </span>
          <span
            role="status"
            className={`text-xs ${s.connection === "open" ? "text-success" : "text-urgent"}`}
          >
            {s.connection === "open"
              ? "Connected"
              : s.connection === "connecting"
                ? "Connecting…"
                : "Reconnecting…"}
          </span>
        </div>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-xs">Demo incident</CardTitle>
            <CardDescription className="text-xs">
              Scripted inputs · fictional incidents
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <label className="sr-only" htmlFor="demo-scenario">
              Demo scenario
            </label>
            <select
              id="demo-scenario"
              className="rounded-md border border-border bg-background p-2 text-xs"
              value={scenario}
              onChange={(event) => setScenario(event.target.value)}
            >
              {DEMO_SCENARIOS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!s.canAct}
                onClick={() => void s.startDemo(scenario)}
              >
                {s.demoPending ? "Starting…" : "Start sample incident"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!s.canAct}
                onClick={() => void s.reset()}
              >
                Reset
              </Button>
            </div>
            {s.demoMessage && (
              <p role="status" className="text-xs text-muted-foreground">
                {s.demoMessage}
              </p>
            )}
          </CardContent>
        </Card>
        {call && (
          <Card key={call.id}>
            <CardHeader>
              <CardDescription className="flex justify-between gap-2 text-xs">
                <span>
                  {call.conversationId?.startsWith("scripted-")
                    ? "Scripted demo"
                    : "Incident"}
                </span>
                <AcuityMark
                  acuity={call.acuity?.value ?? null}
                  source={call.acuity?.source}
                />
              </CardDescription>
              <CardTitle className="text-xl font-normal">
                {callTitle(call)}
              </CardTitle>
              <CardDescription className="text-xs">
                {call.location.text ?? "Location unknown"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <KeySignals call={call} />
              <Separator />
              <LiveCaption call={call} />
            </CardContent>
          </Card>
        )}
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-xs text-muted-foreground">
              Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col px-1.5">
            {state &&
              Object.values(state.calls).map((item) => {
                const task = item.taskId ? state.tasks[item.taskId] : null;
                const unit = task ? state.ambulances[task.ambulanceId] : null;
                return (
                  <CallRow
                    key={item.id}
                    call={item}
                    active={item.id === call?.id}
                    assignedUnit={
                      unit
                        ? `${unit.name}${task?.status === "queued" ? " · queued" : ""}`
                        : undefined
                    }
                    onClick={() => s.selectCall(item.id)}
                  />
                );
              })}
            {state && Object.keys(state.calls).length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                No incidents. Start a sample above.
              </p>
            )}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-xs text-muted-foreground">
              Fleet
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col px-1.5">
            {state &&
              Object.values(state.ambulances).map((unit) => (
                <FleetRow
                  key={unit.id}
                  unit={unit}
                  state={state}
                  tracked={s.trackedId === unit.id}
                  onClick={() =>
                    s.setTrackedId(s.trackedId === unit.id ? null : unit.id)
                  }
                />
              ))}
          </CardContent>
        </Card>
      </aside>
      <section className="dispatch-right" aria-label="Map controls and status">
        <div className="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              s.setTrackedId(null);
              mapRef.current?.overview();
            }}
          >
            <Scan data-icon="inline-start" />
            Overview
          </Button>
        </div>
        {s.connectionError && (
          <div
            role="alert"
            className="rounded-xl border border-urgent/40 bg-background p-3 text-xs text-urgent"
          >
            {s.connectionError}
          </div>
        )}
        {s.operation && (
          <div
            role="status"
            className="rounded-xl border border-border bg-background p-3 text-xs"
          >
            <p>{s.operation.message}</p>
            {s.operation.status === "uncertain" && (
              <Button
                size="sm"
                className="mt-2"
                disabled={s.connection !== "open"}
                onClick={() => void s.retry()}
              >
                Retry same action
              </Button>
            )}
          </div>
        )}
        {tracked && state && (
          <Card size="sm">
            <CardContent>
              <UnitDetail
                unit={tracked}
                state={state}
                onClose={() => s.setTrackedId(null)}
              />
            </CardContent>
          </Card>
        )}
      </section>
      <section className="dispatch-triage" aria-label="Dispatch assessment">
        <TriageCard key={call?.id ?? "empty"} s={s} className="w-full max-w-[560px]" />
      </section>
    </main>
  );
}
