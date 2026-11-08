"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DispatchUiState } from "@/lib/client/useDispatchUi";
import { callTitle, durationLabel, fieldLabel, taskArrival } from "@/lib/client/dispatch-view";
import { AcuityMark } from "./parts";

/** Original floating proposal card, backed by the authoritative recommendation set. */
export function TriageCard({ s, className }: { s: DispatchUiState; className?: string }) {
  const { state, call, set, candidate, task } = s;
  const [confirmedFor, setConfirmedFor] = useState<string | null>(null);
  // Consent applies only to the displayed set, unit, and effective acuity.
  const confirmationKey = `${set?.id}:${candidate?.ambulanceId}:${call?.acuity?.value}`;
  const confirmed = confirmedFor === confirmationKey;
  const cardClass = cn("materialize", className);
  if (!state || !call) return null;

  if (task) return (
    <Card className={cardClass}>
      <CardContent className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-success/15 text-success"><Check className="size-4" /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[13px] font-medium">
            {state.ambulances[task.ambulanceId]?.name ?? task.ambulanceId} · {task.status === "queued" ? "Queued" : fieldLabel(task.phase?.replaceAll("_", " ") ?? task.status)}
          </span>
          <span className="truncate text-xs text-muted-foreground">{call.location.text ?? callTitle(call)}</span>
          {(task.status === "queued" || task.phase === "en_route") && (
            <span className="text-xs text-muted-foreground">Estimated scene arrival: {durationLabel(taskArrival(task, state))}</span>
          )}
        </span>
        <Button variant="secondary" size="sm" onClick={() => s.setTrackedId(task.ambulanceId)}>
          <Crosshair data-icon="inline-start" /> Track
        </Button>
      </CardContent>
    </Card>
  );

  const index = Math.max(0, set?.candidates.findIndex((option) => option.ambulanceId === candidate?.ambulanceId) ?? 0);
  const count = set?.candidates.length ?? 0;
  const selectIndex = (next: number) => {
    const option = set?.candidates[(next + count) % count];
    if (option) s.selectCandidate(option.ambulanceId);
  };
  const unit = candidate ? state.ambulances[candidate.ambulanceId] : null;
  const busy = !!unit && (!!unit.activeTaskId || unit.queuedTaskIds.length > 0 || unit.status === "busy");
  const recommended = !!candidate && candidate.ambulanceId === set?.recommendedAmbulanceId;

  return (
    <Card className={cardClass}>
      <CardHeader>
        <CardTitle className="flex min-w-0 items-center gap-2 text-[13px]">
          {call.status !== "closed" && <span className="live-dot shrink-0" />}
          <span className="truncate">{callTitle(call)}</span>
        </CardTitle>
        <CardDescription className="flex min-w-0 items-center gap-2 text-xs">
          <AcuityMark acuity={call.acuity?.value ?? null} source={call.acuity?.source} />
          <span>·</span><span className="truncate">{call.location.text ?? "Location unknown"}</span>
        </CardDescription>
        {count > 0 && call.status !== "closed" && (
          <CardAction>
            <nav aria-label="Ambulance candidates" className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" aria-label="Previous option" disabled={count < 2} onClick={() => selectIndex(index - 1)}><ChevronLeft /></Button>
              <span aria-live="polite" className="num w-10 text-center text-xs text-muted-foreground">{index + 1} of {count}</span>
              <Button variant="ghost" size="icon-sm" aria-label="Next option" disabled={count < 2} onClick={() => selectIndex(index + 1)}><ChevronRight /></Button>
            </nav>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {call.status === "closed" ? <p>This incident is closed.</p> : !set ? (
          <p className="text-sm text-muted-foreground">Intake in progress · waiting for assessment.</p>
        ) : (
          <>
            {set.status === "needs_more_info" && <p role="status" className="text-sm text-urgent">More information needed: {set.missingFields.map(fieldLabel).join(", ") || "Continue incident intake"}.</p>}
            {set.status === "stale" && <p role="status" className="text-sm text-urgent">Refreshing an outdated assessment. Acceptance is disabled.</p>}
            {set.status === "error" && <Button size="sm" variant="secondary" disabled={!s.canAct} onClick={() => void s.refresh()}>Retry assessment</Button>}
            {candidate && (
              <div key={candidate.ambulanceId} className="swap flex flex-col gap-3" aria-live="polite">
                <div className="flex items-end justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className={cn("text-xs font-medium", candidate.capabilityMismatch || !candidate.selectable ? "text-urgent" : recommended ? "text-success" : "text-muted-foreground")}>
                      {!candidate.selectable ? "Unavailable" : candidate.capabilityMismatch ? "Care-level mismatch" : busy ? "Queued after current job" : recommended ? "Recommended" : "Alternative"}
                    </span>
                    <span className="text-lg tracking-tight">{unit?.name ?? candidate.ambulanceId} <span className="text-muted-foreground">· {candidate.careLevel}</span></span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="display text-4xl">
                      {candidate.arrivalInSeconds == null ? "Unknown" : <>{Math.ceil(Math.max(0, candidate.arrivalInSeconds) / 60)}<span className="ml-1 text-base text-muted-foreground">min</span></>}
                    </span>
                    <span className="text-xs text-muted-foreground">Scene arrival</span>
                  </div>
                </div>
                <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">{candidate.reason ?? set.summary ?? "Assessment received."}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>Available in {durationLabel(candidate.availableInSeconds)} · travel {durationLabel(candidate.travelSeconds)}</span>
                  <span>Crew suitability: {candidate.crewSuitable === null ? "Unknown" : candidate.crewSuitable ? "Suitable" : "Concern"}</span>
                  {busy && <span>Busy · assignment will queue</span>}
                  {!candidate.selectable && <span className="text-urgent">{candidate.unavailableReason ?? "Not selectable"}</span>}
                </div>
              </div>
            )}
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Assessment details</summary>
              <div className="mt-2 flex flex-col gap-1">
                <p>{set.summary ?? "Assessment received."}</p>
                {set.acuity && <><p>Suggested acuity: {set.acuity}</p><p>{set.acuityReason}</p></>}
                <p className="text-[11px]">{set.source === "model" ? `Model · ${set.modelId ?? "Unreported model"}` : "Deterministic fallback · local assessment"}{set.latencyMs !== null && ` · ${Math.round(set.latencyMs)} ms`}</p>
              </div>
            </details>
            {candidate?.capabilityMismatch && candidate.selectable && set.status === "ready" && (
              <label className="flex items-start gap-2 rounded-lg border border-urgent/40 p-3 text-xs text-urgent">
                <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={(event) => setConfirmedFor(event.target.checked ? confirmationKey : null)} />
                I confirm this unit’s care level is below the incident requirement and want to assign it anyway.
              </label>
            )}
          </>
        )}
      </CardContent>
      {set && call.status !== "closed" && (
        <CardFooter className="gap-2">
          <div className="flex flex-1 gap-1" aria-hidden>
            {set.candidates.map((option, i) => <span key={option.ambulanceId} className={cn("h-0.5 flex-1 rounded-full bg-foreground/15 transition-colors duration-200", i === index && "bg-foreground/80")} />)}
          </div>
          <Button size="sm" variant="ghost" disabled={!s.canAct} onClick={() => void s.refresh()}>Refresh</Button>
          <Button size="sm" className="press" variant={candidate?.capabilityMismatch ? "secondary" : "default"}
            disabled={!s.canAct || set.status !== "ready" || !candidate?.selectable || (candidate.capabilityMismatch && !confirmed)}
            onClick={() => void s.accept(confirmed)}>
            {candidate ? `Assign ${unit?.name ?? candidate.ambulanceId}` : "No candidates available"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
