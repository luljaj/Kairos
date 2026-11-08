"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DispatchUiState } from "@/lib/client/useDispatchUi";
import {
  durationLabel,
  fieldLabel,
  taskArrival,
} from "@/lib/client/dispatch-view";
import { AcuityMark } from "./parts";

export function TriageCard({
  s,
  className,
}: {
  s: DispatchUiState;
  className?: string;
}) {
  const { state, call, set, candidate, task } = s;
  const [confirmedFor, setConfirmedFor] = useState<string | null>(null);
  // Consent applies only to the displayed set, unit, and effective acuity.
  const confirmationKey = `${set?.id}:${candidate?.ambulanceId}:${call?.acuity?.value}`;
  const confirmed = confirmedFor === confirmationKey;
  if (!state || !call)
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>
            {state ? "Ready for an incident" : "Connecting to dispatch…"}
          </CardTitle>
          <CardDescription>
            {state
              ? "Start a scripted demo incident from the controls on the left."
              : "Waiting for the first backend snapshot."}
          </CardDescription>
        </CardHeader>
      </Card>
    );

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">
            {task ? "Assignment" : "Assessment"}
          </CardTitle>
          {!task && call.status !== "closed" && (
            <Button
              size="xs"
              variant="ghost"
              disabled={!s.canAct}
              onClick={() => void s.refresh()}
            >
              Refresh
            </Button>
          )}
        </div>
        <CardDescription>
          <AcuityMark
            acuity={call.acuity?.value ?? null}
            source={call.acuity?.source}
          />
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {task ? (
          <>
            <p className="text-lg">
              {state.ambulances[task.ambulanceId]?.name ?? task.ambulanceId} ·{" "}
              {task.status === "queued"
                ? "Queued"
                : fieldLabel(task.phase?.replaceAll("_", " ") ?? task.status)}
            </p>
            <p className="text-xs text-muted-foreground">
              Assignment recorded by the backend.
            </p>
            {(task.status === "queued" || task.phase === "en_route") && (
              <p>
                Estimated scene arrival:{" "}
                {durationLabel(taskArrival(task, state))}
              </p>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => s.setTrackedId(task.ambulanceId)}
            >
              Track assigned unit
            </Button>
          </>
        ) : call.status === "closed" ? (
          <p>This incident is closed.</p>
        ) : (
          <>
            {!set && (
              <p className="text-sm text-muted-foreground">
                Intake in progress · waiting for assessment.
              </p>
            )}
            {set && (
              <>
                <p className="text-[13px] leading-relaxed">
                  {set.summary ?? "Assessment received."}
                </p>
                {set.status === "needs_more_info" && (
                  <div role="status" className="text-sm text-urgent">
                    More information needed:{" "}
                    {set.missingFields.map(fieldLabel).join(", ") ||
                      "Continue incident intake"}
                    .
                  </div>
                )}
                {set.status === "stale" && (
                  <p role="status" className="text-sm text-urgent">
                    Refreshing an outdated assessment. Acceptance is disabled.
                  </p>
                )}
                {set.status === "error" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!s.canAct}
                    onClick={() => void s.refresh()}
                  >
                    Retry assessment
                  </Button>
                )}
                {set.acuity && (
                  <div className="text-xs text-muted-foreground">
                    <p>Suggested acuity: {set.acuity}</p>
                    <p>{set.acuityReason}</p>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {set.source === "model"
                    ? `Model · ${set.modelId ?? "Unreported model"}`
                    : "Deterministic fallback · local assessment"}
                  {set.latencyMs !== null &&
                    ` · ${Math.round(set.latencyMs)} ms`}
                </p>
                <div
                  className="flex flex-col gap-2"
                  aria-label="Ambulance candidates"
                >
                  {set.candidates.map((option) => {
                    const unit = state.ambulances[option.ambulanceId];
                    const selected =
                      candidate?.ambulanceId === option.ambulanceId;
                    const busy =
                      !!unit &&
                      (!!unit.activeTaskId ||
                        unit.queuedTaskIds.length > 0 ||
                        unit.status === "busy");
                    return (
                      <button
                        type="button"
                        key={option.ambulanceId}
                        aria-pressed={selected}
                        onClick={() => s.selectCandidate(option.ambulanceId)}
                        className={`rounded-xl border p-3 text-left ${selected ? "border-foreground/50 bg-accent" : "border-border hover:bg-accent/50"}`}
                      >
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-sm">
                            {unit?.name ?? option.ambulanceId} ·{" "}
                            {option.careLevel}
                          </span>
                          <span className="text-sm num">
                            {durationLabel(option.arrivalInSeconds)}
                          </span>
                        </span>
                        <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px]">
                          {option.ambulanceId ===
                            set.recommendedAmbulanceId && (
                            <span className="text-success">Recommended</span>
                          )}
                          {option.capabilityMismatch && (
                            <span className="text-urgent">
                              Care-level mismatch
                            </span>
                          )}
                          {busy && <span>Busy · assignment will queue</span>}
                          {!option.selectable && (
                            <span className="text-urgent">
                              Unavailable ·{" "}
                              {option.unavailableReason ?? "Not selectable"}
                            </span>
                          )}
                          <span>
                            Crew suitability:{" "}
                            {option.crewSuitable === null
                              ? "Unknown"
                              : option.crewSuitable
                                ? "Suitable"
                                : "Concern"}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Available in{" "}
                          {durationLabel(option.availableInSeconds)} · travel{" "}
                          {durationLabel(option.travelSeconds)} · total arrival
                          above
                        </span>
                        {option.reason && (
                          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                            {option.reason}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {candidate?.capabilityMismatch &&
                  candidate.selectable &&
                  set.status === "ready" && (
                    <label className="flex items-start gap-2 rounded-lg border border-urgent/40 p-3 text-xs text-urgent">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={confirmed}
                        onChange={(event) =>
                          setConfirmedFor(
                            event.target.checked ? confirmationKey : null,
                          )
                        }
                      />
                      I confirm this unit’s care level is below the incident
                      requirement and want to assign it anyway.
                    </label>
                  )}
                <Button
                  size="sm"
                  disabled={
                    !s.canAct ||
                    set.status !== "ready" ||
                    !candidate?.selectable ||
                    (candidate.capabilityMismatch && !confirmed)
                  }
                  onClick={() => void s.accept(confirmed)}
                >
                  {candidate
                    ? `Assign ${state.ambulances[candidate.ambulanceId]?.name ?? candidate.ambulanceId}`
                    : "No candidates available"}
                </Button>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
