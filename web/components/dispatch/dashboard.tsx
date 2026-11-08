"use client";

import { Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useRef } from "react";
import "./dispatch.css";
import { DispatchMap, type DispatchMapHandle } from "./dispatch-map";
import {
  ACTIVE_CALL,
  Mark,
  AcuityMark,
  CallRow,
  Clock,
  FleetRow,
  KeySignals,
  LiveCaption,
  OTHER_CALLS,
  UnitDetail,
} from "./parts";
import { TriageCard } from "./triage-card";
import { useDispatchUi } from "@/lib/dispatch-mock/use-dispatch-ui";

const COLUMN = 360;
const INSET = 16;

/**
 * Operator dashboard (Orbit) — the map is the whole canvas. The left column is a stack of floating
 * glass islands; the city drifts slowly when nobody is touching it.
 */
export function DispatchDashboard() {
  const s = useDispatchUi();
  const mapRef = useRef<DispatchMapHandle>(null);
  const tracked = s.trackedId ? s.sim.units.find((u) => u.id === s.trackedId) : null;

  return (
    <div className="dispatch dark">
      <DispatchMap
        ref={mapRef}
        sim={s.sim}
        trackedId={s.trackedId}
        proposal={s.proposal}
        padding={{ top: 80, right: tracked ? 360 : 40, bottom: 240, left: COLUMN + INSET * 2 }}
        onSelectUnit={s.setTrackedId}
      />

      {/* Left column: three islands, each its own surface */}
      <div
        className="pointer-events-none absolute top-0 bottom-0 left-0 flex flex-col gap-3"
        style={{ width: COLUMN + INSET, padding: INSET, paddingRight: 0 }}
      >
        <div className="pointer-events-auto flex items-center justify-between px-2 py-1">
          <span className="flex items-center gap-1.5">
            <Mark />
            <span className="text-[15px] font-medium tracking-tight">Kairos</span>
          </span>
          <Clock className="text-xs text-muted-foreground" />
        </div>

        <Card className="pointer-events-auto shrink-0">
          <CardHeader>
            <CardDescription className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-2">
                <span className="live-dot" /> Live · {ACTIVE_CALL.startedAt}
              </span>
              <AcuityMark acuity={ACTIVE_CALL.acuity} suggested />
            </CardDescription>
            <CardTitle className="text-xl font-normal tracking-tight">{ACTIVE_CALL.title}</CardTitle>
            <CardDescription className="text-xs">{ACTIVE_CALL.location}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <KeySignals call={ACTIVE_CALL} elapsed={s.sim.elapsed} />
            <Separator />
            <LiveCaption call={ACTIVE_CALL} elapsed={s.sim.elapsed} />
          </CardContent>
        </Card>
        <div className="flex-1" />

        <Card size="sm" className="pointer-events-auto shrink-0 gap-1">
          <CardHeader>
            <CardTitle className="text-xs font-medium text-muted-foreground">Queue</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col px-1.5">
            {OTHER_CALLS.map((c) => (
              <CallRow
                key={c.id}
                call={c}
                assignedUnit={c.stage === "assigned" ? "Medic 3" : undefined}
                onClick={() => c.stage === "assigned" && s.setTrackedId("amb-3")}
              />
            ))}
          </CardContent>
        </Card>

        <Card size="sm" className="pointer-events-auto shrink-0 gap-1">
          <CardHeader>
            <CardTitle className="text-xs font-medium text-muted-foreground">Fleet</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col px-1.5">
            {s.sim.units.map((u) => (
              <FleetRow key={u.id} live={u} tracked={s.trackedId === u.id} onClick={() => s.track(u.id)} />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="absolute top-4 right-4 flex flex-col items-end gap-3">
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
        {tracked && (
          <Card key={tracked.id} className="materialize w-80" style={{ transformOrigin: "top right" }}>
            <CardContent>
              <UnitDetail live={tracked} onClose={() => s.setTrackedId(null)} />
            </CardContent>
          </Card>
        )}
      </div>

      <div
        className="absolute bottom-6 flex justify-center"
        style={{ left: COLUMN + INSET * 2, right: INSET }}
      >
        <TriageCard s={s} className="w-full max-w-[560px]" />
      </div>
    </div>
  );
}
