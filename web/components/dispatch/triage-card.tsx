"use client";

import { Check, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TRIAGE, unitById } from "@/lib/dispatch-mock/data";
import type { DispatchUiState } from "@/lib/dispatch-mock/use-dispatch-ui";
import { AcuityMark, ACTIVE_CALL, OptionPager, TriageOptionBody } from "./parts";

/** The triage proposal that rises when the AI has a recommendation. Options flip; the map previews each route. */
export function TriageCard({ s, className }: { s: DispatchUiState; className?: string }) {
  if (s.sent) {
    const u = unitById(s.sent.unitId);
    return (
      <Card size="sm" className={cn("materialize", className)}>
        <CardContent className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-full bg-success/15 text-success">
            <Check className="size-4" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[13px] font-medium">
              {u.name} {s.sent.queued ? "queued for" : "dispatched to"} {ACTIVE_CALL.location.split(",")[0]}
            </span>
            <span className="text-xs text-muted-foreground">Crew notified · route sent to MDT</span>
          </span>
          <Button variant="secondary" size="sm" onClick={() => s.setTrackedId(u.id)}>
            <Crosshair data-icon="inline-start" />
            Track
          </Button>
        </CardContent>
      </Card>
    );
  }

  const o = s.option;
  const u = unitById(o.unitId);
  return (
    <Card className={cn("materialize", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[13px]">
          <span className="live-dot" />
          {ACTIVE_CALL.title}
        </CardTitle>
        <CardDescription className="flex items-center gap-2 text-xs">
          <AcuityMark acuity={ACTIVE_CALL.acuity} suggested />
          <span>·</span>
          <span className="truncate">{ACTIVE_CALL.location}</span>
        </CardDescription>
        <CardAction>
          <OptionPager count={TRIAGE.length} index={s.index} onIndex={s.setIndex} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <TriageOptionBody option={o} dir={s.dir} />
      </CardContent>
      <CardFooter className="gap-2">
        <div className="flex flex-1 gap-1" aria-hidden>
          {TRIAGE.map((t, i) => (
            <span
              key={t.unitId}
              className={cn(
                "h-0.5 flex-1 rounded-full bg-foreground/15 transition-colors duration-200",
                i === s.index && "bg-foreground/80",
              )}
            />
          ))}
        </div>
        <Button variant="ghost" size="sm">
          Hold
        </Button>
        <Button size="sm" variant={o.verdict === "mismatch" ? "secondary" : "default"} className="press" onClick={s.send}>
          {o.verdict === "queued" ? `Queue ${u.name}` : o.verdict === "mismatch" ? "Send anyway" : `Send ${u.name}`}
        </Button>
      </CardFooter>
    </Card>
  );
}
