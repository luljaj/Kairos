"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  careLevelOf,
  selectability,
  type Acuity,
  type Ambulance,
  type Call,
  type DispatchState,
} from "@/lib/contracts";
import {
  callTitle,
  crewRoleLabels,
  durationLabel,
  fieldLabel,
  qualificationLabels,
  taskArrival,
  unitStatus,
} from "@/lib/client/dispatch-view";

export function AcuityMark({
  acuity,
  source,
}: {
  acuity: Acuity | null;
  source?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        acuity === "Echo" || acuity === "Delta"
          ? "text-critical"
          : acuity === "Charlie"
            ? "text-urgent"
            : "text-muted-foreground",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {acuity ?? "Unassessed"}
      {source && (
        <span className="font-normal text-muted-foreground">{source}</span>
      )}
    </span>
  );
}

export function KeySignals({ call }: { call: Call }) {
  const facts = Object.entries(call.facts).filter(
    ([, value]) => value !== null,
  );
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
      {facts.length ? (
        facts.map(([key, value]) => (
          <div key={key} className={key === "notes" ? "col-span-2" : ""}>
            <dt className="text-muted-foreground">{fieldLabel(key)}</dt>
            <dd className="break-words">
              {typeof value === "boolean"
                ? value
                  ? "Yes"
                  : "No"
                : String(value)}
            </dd>
          </div>
        ))
      ) : (
        <p className="col-span-2 text-muted-foreground">
          Gathering incident details…
        </p>
      )}
    </dl>
  );
}

export function LiveCaption({ call }: { call: Call }) {
  const [open, setOpen] = useState(false);
  const lines = open ? call.transcript : call.transcript.slice(-2);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Transcript</span>
        <Button
          variant="ghost"
          size="xs"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "Collapse" : `All ${call.transcript.length}`}
        </Button>
      </div>
      <div
        className="flex max-h-48 flex-col gap-2 overflow-y-auto"
        aria-live="polite"
      >
        {lines.map((line, i) => (
          <p
            key={`${line.at}-${i}`}
            className="text-[13px] leading-relaxed break-words"
          >
            <span className="text-muted-foreground">
              {line.role === "caller" ? "Caller" : "Assistant"} —{" "}
            </span>
            {line.text}
          </p>
        ))}
        {!lines.length && (
          <p className="text-xs text-muted-foreground">
            No transcript received.
          </p>
        )}
      </div>
    </div>
  );
}

export function CallRow({
  call,
  active,
  onClick,
  assignedUnit,
}: {
  call: Call;
  active?: boolean;
  onClick: () => void;
  assignedUnit?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={!!active}
      data-active={active}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-accent data-[active=true]:bg-accent"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px]">{callTitle(call)}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {call.location.text ?? "Location unknown"}
        </span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {assignedUnit ?? fieldLabel(call.status.replaceAll("_", " "))}
      </span>
    </button>
  );
}

export function FleetRow({
  unit,
  state,
  tracked,
  onClick,
}: {
  unit: Ambulance;
  state: DispatchState;
  tracked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={tracked}
      data-active={tracked}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-accent data-[active=true]:bg-accent"
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          unit.status === "available" ? "bg-success" : "bg-muted-foreground",
        )}
      />
      <span className="text-[13px]">{unit.name}</span>
      <span className="text-xs text-muted-foreground">
        {careLevelOf(unit, state.crew)}
      </span>
      <span className="ml-auto text-right text-xs text-muted-foreground">
        {unitStatus(unit, state)}
        {unit.queuedTaskIds.length > 0 &&
          ` · ${unit.queuedTaskIds.length} queued`}
      </span>
    </button>
  );
}

export function UnitDetail({
  unit,
  state,
  onClose,
}: {
  unit: Ambulance;
  state: DispatchState;
  onClose: () => void;
}) {
  const task = unit.activeTaskId ? state.tasks[unit.activeTaskId] : null;
  const call = task ? state.calls[task.callId] : null;
  const eligibility = selectability(unit, state.crew);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-lg">
          {unit.name} · {careLevelOf(unit, state.crew)}
        </span>
        <Button variant="ghost" size="xs" onClick={onClose}>
          Stop tracking
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {unitStatus(unit, state)}
        {!eligibility.selectable && ` · ${eligibility.unavailableReason}`}
      </p>
      {task && (
        <div className="text-sm">
          <p>
            {task.phase === "transporting"
              ? (task.hospital?.name ?? "Destination unknown")
              : (call?.location.text ?? "Location unknown")}
          </p>
          {task.phase === "en_route" && (
            <p>
              Estimated scene arrival: {durationLabel(taskArrival(task, state))}
            </p>
          )}
          {task.route && (
            <p className="text-xs text-muted-foreground">
              Route: {(task.route.distanceMeters / 1609.344).toFixed(1)} mi
              {task.route.estimated ? " · estimated" : ""}
            </p>
          )}
        </div>
      )}
      {unit.queuedTaskIds.map((id) => {
        const queued = state.tasks[id];
        return (
          queued && (
            <p key={id} className="text-xs">
              Queued:{" "}
              {state.calls[queued.callId]?.location.text ?? queued.callId} ·
              arrival {durationLabel(taskArrival(queued, state))}
            </p>
          )
        );
      })}
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        {unit.crewIds.map((id) => {
          const member = state.crew[id];
          return (
            member && (
              <div key={id} className="text-xs">
                <p>
                  <strong className="font-bold">{member.name}</strong> · {crewRoleLabels[member.role]}
                </p>
                <p className="text-muted-foreground">
                  {member.qualifications
                    .map((q) => qualificationLabels[q])
                    .join(" · ")}
                </p>
              </div>
            )
          );
        })}
      </div>
    </div>
  );
}

/**
 * Kairos mark — a dial open at one instant. Sized to the 15px wordmark: an 18px box puts the
 * ring just above cap height (round forms need overshoot) and the 2-unit stroke renders ~1.5px,
 * matching Geist Medium's stem weight.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-[18px] shrink-0", className)} aria-hidden fill="none">
      <path d="M15.2 3.6A9 9 0 1 0 20.4 8.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18.6" cy="5.4" r="2.1" fill="currentColor" />
    </svg>
  );
}
