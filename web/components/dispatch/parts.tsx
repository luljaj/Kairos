"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Navigation, Radio, Satellite, Signal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ACUITY_TONE,
  CALLS,
  unitById,
  type Acuity,
  type Call,
  type TriageOption,
} from "@/lib/dispatch-mock/data";
import { MEASURED, minutesLeft, type UnitLive } from "@/lib/dispatch-mock/sim";

/* ---------------------------------------------------------------- atoms -- */

const toneText = {
  critical: "text-critical",
  urgent: "text-urgent",
  routine: "text-muted-foreground",
} as const;
const toneBg = {
  critical: "bg-critical",
  urgent: "bg-urgent",
  routine: "bg-muted-foreground",
} as const;

export function AcuityMark({ acuity, suggested }: { acuity: Acuity; suggested?: boolean }) {
  const tone = ACUITY_TONE[acuity];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={cn("size-1.5 rounded-full", toneBg[tone])} />
      <span className={cn("font-medium", toneText[tone])}>{acuity}</span>
      {suggested && <span className="text-muted-foreground">suggested</span>}
    </span>
  );
}

const STATUS_LABEL: Record<UnitLive["status"], string> = {
  available: "Available",
  en_route: "En route",
  transporting: "Transporting",
  on_scene: "On scene",
};

export function StatusMark({ status }: { status: UnitLive["status"] }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "available" ? "bg-success" : status === "on_scene" ? "bg-urgent" : "bg-foreground",
        )}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Clock({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  return (
    <span className={cn("num", className)} suppressHydrationWarning>
      {now?.toLocaleTimeString("en-US", { hour12: false }) ?? "--:--:--"}
    </span>
  );
}

const initials = (n: string) =>
  n
    .split(" ")
    .map((p) => p[0])
    .join("");

/* --------------------------------------------------------- live call -- */

/** What the dispatcher must know, in words — flagged signals first, context after. */
export function KeySignals({ call, elapsed }: { call: Call; elapsed: number }) {
  const facts = call.facts.filter((f) => f.at <= elapsed && f.signal);
  const flagged = facts.filter((f) => f.flag);
  const context = facts.filter((f) => !f.flag);
  if (!facts.length) return <span className="text-[13px] text-muted-foreground">Gathering details…</span>;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
      {flagged.map((f) => (
        <span key={f.label} className="enter inline-flex items-center gap-1.5 font-medium text-critical">
          <span className="size-1 rounded-full bg-critical" />
          {f.signal}
        </span>
      ))}
      {context.map((f) => (
        <span key={f.label} className="enter text-muted-foreground">
          {f.signal}
        </span>
      ))}
    </div>
  );
}

/** Live caption: only the latest exchange is loud; the rest is one tap away. */
export function LiveCaption({ call, elapsed }: { call: Call; elapsed: number }) {
  const [open, setOpen] = useState(false);
  const lines = call.transcript.filter((l) => l.at <= elapsed);
  const last = lines.at(-1);
  const prev = lines.at(-2);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">Transcript</span>
        <Button variant="ghost" size="xs" onClick={() => setOpen((o) => !o)}>
          {open ? "Collapse" : `All ${lines.length}`}
        </Button>
      </div>
      {open ? (
        <LiveTranscript call={call} elapsed={elapsed} />
      ) : (
        <div className="flex flex-col gap-1.5">
          {prev && (
            <p key={`p${prev.at}`} className="line-clamp-1 text-xs text-muted-foreground">
              {prev.text}
            </p>
          )}
          {last && (
            <p key={last.at} className="enter text-[14px] leading-snug text-pretty">
              <span className="text-muted-foreground">{last.speaker === "caller" ? "Caller — " : "AI — "}</span>
              {last.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function LiveTranscript({ call, elapsed, maxLines }: { call: Call; elapsed: number; maxLines?: number }) {
  const lines = call.transcript.filter((l) => l.at <= elapsed);
  const shown = maxLines ? lines.slice(-maxLines) : lines;
  const pending = call.transcript.some((l) => l.at > elapsed);
  return (
    <div className="flex flex-col gap-3">
      {shown.map((l) => (
        <div key={l.at} className="enter flex flex-col gap-0.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            {l.speaker === "caller" ? "Caller" : "Assistant"}
          </span>
          <p
            className={cn(
              "text-[13px] leading-relaxed text-pretty",
              l.speaker === "caller" ? "text-foreground" : "text-foreground/70",
            )}
          >
            {l.text}
          </p>
        </div>
      ))}
      {pending && (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" aria-live="polite">
          <span className="animate-pulse">Listening…</span>
        </span>
      )}
    </div>
  );
}

const STAGE: Record<Call["stage"], string> = {
  intake: "Intake",
  gathering: "Gathering details",
  awaiting: "Awaiting decision",
  assigned: "Assigned",
};

export function CallRow({
  call,
  active,
  onClick,
  assignedUnit,
}: {
  call: Call;
  active?: boolean;
  onClick?: () => void;
  assignedUnit?: string;
}) {
  const tone = ACUITY_TONE[call.acuity];
  return (
    <button
      onClick={onClick}
      data-active={active}
      className="press flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors duration-150 hover:bg-accent data-[active=true]:bg-accent"
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", toneBg[tone])} />
      <span className="min-w-0 flex-1 truncate text-[13px]">{call.title}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{assignedUnit ?? STAGE[call.stage]}</span>
    </button>
  );
}

/* --------------------------------------------------------------- fleet -- */

export function FleetRow({
  live,
  tracked,
  onClick,
}: {
  live: UnitLive;
  tracked?: boolean;
  onClick?: () => void;
}) {
  const u = unitById(live.id);
  const mins = minutesLeft(live);
  return (
    <button
      onClick={onClick}
      data-active={tracked}
      className="press flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors duration-150 hover:bg-accent data-[active=true]:bg-accent"
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          live.status === "available" ? "bg-success" : live.status === "on_scene" ? "bg-urgent" : "bg-foreground",
        )}
      />
      <span className="text-[13px]">{u.name}</span>
      <span className="text-xs text-muted-foreground">{u.care}</span>
      <span className="ml-auto text-xs text-muted-foreground">
        {live.routeKey ? (
          <>
            {live.status === "transporting" ? "Lourdes" : "Scene"}{" "}
            <span className="num font-medium text-foreground">{mins} min</span>
          </>
        ) : (
          STATUS_LABEL[live.status]
        )}
      </span>
    </button>
  );
}

/** Image-3 style unit card: identity, telemetry, route progress, crew. */
export function UnitDetail({ live, onClose }: { live: UnitLive; onClose?: () => void }) {
  const u = unitById(live.id);
  const mins = minutesLeft(live);
  const destination = live.status === "transporting" ? "Lourdes" : live.routeKey ? "Bartle Library" : u.station;
  const distLeft = live.routeKey ? ((1 - live.progress) * MEASURED[live.routeKey].total) / 1609 : 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xl font-normal tracking-tight">{u.name}</span>
          <span className="text-xs text-muted-foreground">
            {u.care} · <Clock />
          </span>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Stop tracking
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <StatusMark status={live.status} />
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Satellite className="size-3.5" /> GPS
          </span>
          <span className="inline-flex items-center gap-1">
            <Signal className="size-3.5" /> LTE
          </span>
        </span>
      </div>

      {live.routeKey ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-end justify-between">
            <span className="display text-4xl">
              {mins}
              <span className="ml-1 text-base text-muted-foreground">min</span>
            </span>
            <span className="num text-xs text-muted-foreground">{distLeft.toFixed(1)} mi left</span>
          </div>
          <Progress value={live.progress * 100} />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Navigation className="size-3" /> Now
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" /> {destination}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Radio className="size-3.5" /> Holding at {u.station}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {u.crew.map((c) => (
          <div key={c.name} className="flex items-center gap-2.5">
            <Avatar className="size-7">
              <AvatarFallback className="text-[11px]">{initials(c.name)}</AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px]">{c.name}</span>
              <span className="text-[11px] text-muted-foreground">{c.role}</span>
            </span>
            <span className="text-xs text-muted-foreground">{c.cert}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- triage -- */

const VERDICT = {
  recommended: { label: "Recommended", className: "text-success" },
  mismatch: { label: "Care-level mismatch", className: "text-urgent" },
  queued: { label: "Queued after current job", className: "text-muted-foreground" },
} as const;

export function TriageOptionBody({ option, dir }: { option: TriageOption; dir: number }) {
  const u = unitById(option.unitId);
  const miles = MEASURED[option.routeKey].total / 1609;
  const total = option.etaMin + (option.waitMin ?? 0);
  return (
    <div key={option.unitId} className="swap flex flex-col gap-3" style={{ ["--swap-from" as string]: `${dir * 10}px` }}>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", VERDICT[option.verdict].className)}>
            {VERDICT[option.verdict].label}
          </span>
          <span className="text-lg tracking-tight">
            {u.name} <span className="text-muted-foreground">· {u.care}</span>
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="display text-4xl">
            {total}
            <span className="ml-1 text-base text-muted-foreground">min</span>
          </span>
          <span className="num text-xs text-muted-foreground">
            {miles.toFixed(1)} mi{option.waitMin ? ` · ${option.waitMin} min wait` : ""}
          </span>
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">{option.reason}</p>
    </div>
  );
}

export function OptionPager({
  count,
  index,
  onIndex,
}: {
  count: number;
  index: number;
  onIndex: (i: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Previous option"
        onClick={() => onIndex((index - 1 + count) % count)}
      >
        <ChevronLeft />
      </Button>
      <span className="num w-10 text-center text-xs text-muted-foreground">
        {index + 1} of {count}
      </span>
      <Button variant="ghost" size="icon-sm" aria-label="Next option" onClick={() => onIndex((index + 1) % count)}>
        <ChevronRight />
      </Button>
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

export const ACTIVE_CALL = CALLS[0];
export const OTHER_CALLS = CALLS.slice(1);
