"use client";

import { useEffect, useRef, useState } from "react";
import { Play, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { DEMO_SCENARIOS, type DispatchUiState } from "@/lib/client/useDispatchUi";
import { fleetDemoScenario } from "@/lib/demo/scenarios";
import { randomIncidentOption } from "@/lib/demo/random-incidents";
import { premadeIncident } from "@/lib/demo/premade-incidents";

export function DemoPanel({ s }: { s: DispatchUiState }) {
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState<string>(DEMO_SCENARIOS[0].id);
  const previousFocus = useRef<HTMLElement | null>(null);
  const scenarioTrigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== "d") return;
      event.preventDefault();
      if (event.repeat) return;
      if (!open) previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen((value) => !value);
    }
    window.addEventListener("keydown", shortcut, true);
    return () => window.removeEventListener("keydown", shortcut, true);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={setOpen} modal={false}>
      <SheetContent
        asChild
        showOverlay={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          scenarioTrigger.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (previousFocus.current?.isConnected) previousFocus.current.focus();
        }}
      >
        <Card className="dark demo-panel">
          <CardHeader>
            <SheetTitle asChild><CardTitle variant="section">Demo Scenarios</CardTitle></SheetTitle>
            <SheetDescription asChild><CardDescription>Scripted inputs · fictional incidents</CardDescription></SheetDescription>
            <CardAction align="title">
              <SheetClose asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Close"><X /></Button>
              </SheetClose>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="demo-scenario" className="text-xs font-medium text-muted-foreground">Scenario</label>
              <Select value={scenario} onValueChange={setScenario}>
                <SelectTrigger ref={scenarioTrigger} id="demo-scenario" className="w-full text-xs data-[size=default]:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" align="end" className="dark dispatch-surface p-1">
                  {DEMO_SCENARIOS.map((item) => (
                    <SelectItem key={item.id} value={item.id} className="py-2 text-xs">{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {premadeIncident(scenario) && (
                <p className="text-xs text-muted-foreground">{premadeIncident(scenario)!.description} Adds a scripted call without resetting the fleet.</p>
              )}
              {randomIncidentOption(scenario) && (
                <p className="text-xs text-muted-foreground">{randomIncidentOption(scenario)!.description}</p>
              )}
              {fleetDemoScenario(scenario) && (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>{fleetDemoScenario(scenario)!.description}</p>
                  <p><strong className="font-medium text-foreground">Show the judges: </strong>{fleetDemoScenario(scenario)!.demonstrate}</p>
                  <p>Runs at 1× speed. Replaces the current demo. Clear returns all units to base.</p>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-9 flex-1" disabled={!s.canAct} onClick={() => void s.startDemo(scenario)}>
                <Play data-icon="inline-start" />
                {s.demoPending ? "Starting…" : "Start scenario"}
              </Button>
              <Button size="sm" variant="outline" className="h-9" disabled={!s.canAct} onClick={() => void s.reset()}>
                <RotateCcw data-icon="inline-start" /> Clear
              </Button>
            </div>
            {s.demoMessage && <p role="status" className="text-xs text-muted-foreground">{s.demoMessage}</p>}
          </CardContent>
          <CardFooter className="justify-between">
            <span>Toggle demo controls</span>
            <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[11px]">⌘ D</kbd>
          </CardFooter>
        </Card>
      </SheetContent>
    </Sheet>
  );
}
