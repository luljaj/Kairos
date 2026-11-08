"use client";

import { useState } from "react";
import { Building2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type Ambulance, type DispatchState } from "@/lib/contracts";
import { FleetRow } from "./parts";

export function SquadroomMarker({ units, state, trackedId, onSelectUnit }: {
  units: Ambulance[];
  state: DispatchState;
  trackedId: string | null;
  onSelectUnit: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const tracked = units.some((unit) => unit.id === trackedId);
  return (
    <div className="squadroom-anchor">
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label="Squad Room"
          className="squadroom-trigger"
          data-tracked={tracked}
          data-keyboard={keyboard}
          onPointerEnter={() => setKeyboard(false)}
          onPointerDown={() => setKeyboard(false)}
          onKeyDown={() => setKeyboard(true)}
        >
          <Building2 className="squadroom-icon" aria-hidden="true" />
          <span className="squadroom-label" aria-hidden="true">Squad Room</span>
          <ChevronDown className="squadroom-chevron" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        portalled={false}
        side="top"
        avoidCollisions={false}
        aria-label="Cars at Squad Room"
        data-keyboard={keyboard}
        onKeyDownCapture={() => setKeyboard(true)}
        onInteractOutside={(event) => {
          // Keep the card attached while the operator pans or zooms the map.
          if (event.target instanceof Element && event.target.closest(".mapboxgl-canvas-container")) event.preventDefault();
        }}
        className="squadroom-popover w-72 gap-0 bg-transparent p-0 shadow-none ring-0"
      >
        <Card size="sm" className="dispatch-list-card">
          <CardHeader>
            <CardTitle className="dispatch-section-title">Squad Room</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col px-1">
            {units.map((unit) => (
              <FleetRow key={unit.id} unit={unit} state={state} tracked={unit.id === trackedId} onClick={() => { onSelectUnit(unit.id); setOpen(false); }} />
            ))}
            {!units.length && <p className="px-3 py-2 text-xs text-muted-foreground">No cars parked at base.</p>}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
    </div>
  );
}
