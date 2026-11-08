"use client";

import { useRef } from "react";
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
import { useDispatchUi } from "@/lib/client/useDispatchUi";
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
import { DemoPanel } from "./demo-panel";

export function DispatchDashboard() {
  const s = useDispatchUi();
  const mapRef = useRef<DispatchMapHandle>(null);
  const { state, call } = s;
  const queuedCalls = Object.values(state?.calls ?? {}).filter((item) => item.status !== "closed");
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
        <div className="flex items-center justify-between px-4 py-1">
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
        {call && (
          <Card key={call.id}>
            <CardHeader>
              <CardDescription className="flex justify-between gap-2">
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
              <CardTitle variant="headline">
                {callTitle(call)}
              </CardTitle>
              <CardDescription>
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
        <Card layout="list">
          <CardHeader>
            <CardTitle variant="section">
              Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {state &&
              queuedCalls.map((item) => {
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
            {state && queuedCalls.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                No active incidents.
              </p>
            )}
          </CardContent>
        </Card>
        <Card layout="list">
          <CardHeader>
            <CardTitle variant="section">
              Fleet
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          <Card role="alert">
            <CardContent className="text-xs text-urgent">{s.connectionError}</CardContent>
          </Card>
        )}
        {s.operation && (
          <Card role="status">
            <CardContent className="flex flex-col gap-2 text-xs">
            <p>{s.operation.message}</p>
            {s.operation.status === "uncertain" && (
              <Button
                size="sm"
                disabled={s.connection !== "open"}
                onClick={() => void s.retry()}
              >
                Retry same action
              </Button>
            )}
            </CardContent>
          </Card>
        )}
        {tracked && state && (
          <Card>
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
      <DemoPanel s={s} />
      {state && call && call.status !== "closed" && (
        <section className="dispatch-triage" aria-label="Dispatch assessment">
          <TriageCard key={call.id} s={s} className="w-full max-w-[560px]" />
        </section>
      )}
    </main>
  );
}
