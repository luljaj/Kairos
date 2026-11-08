"use client";

import { useEffect, useRef, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DEMO_SCENARIOS, type DispatchUiState } from "@/lib/client/useDispatchUi";
import { fleetDemoScenario } from "@/lib/demo/scenarios";

export function DemoPanel({ s }: { s: DispatchUiState }) {
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState<string>(DEMO_SCENARIOS[0].id);
  const previousFocus = useRef<HTMLElement | null>(null);

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
        showOverlay={false}
        className="dark dispatch-card-surface demo-panel"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (previousFocus.current?.isConnected) previousFocus.current.focus();
        }}
      >
        <SheetHeader className="gap-1 p-0 pr-8">
          <SheetTitle className="dispatch-section-title">Demo Scenarios</SheetTitle>
          <SheetDescription className="text-xs leading-relaxed">
            Scripted inputs · fictional incidents
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2">
          <label htmlFor="demo-scenario" className="text-xs font-medium text-muted-foreground">Scenario</label>
          <Select value={scenario} onValueChange={setScenario}>
            <SelectTrigger id="demo-scenario" className="w-full text-xs data-[size=default]:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end" className="dark dispatch-surface p-1">
              {DEMO_SCENARIOS.map((item) => (
                <SelectItem key={item.id} value={item.id} className="py-2 text-xs">{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fleetDemoScenario(scenario) && (
            <p className="text-xs text-muted-foreground">
              {fleetDemoScenario(scenario)!.description} Replaces the current demo.
            </p>
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
        <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
          <span>Toggle demo controls</span>
          <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[11px]">⌘ D</kbd>
        </div>
      </SheetContent>
    </Sheet>
  );
}
