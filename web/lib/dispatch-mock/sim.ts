"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ROUTES, UNITS, type LngLat, type Route, type UnitStatus } from "./data";

/** Simulated seconds per real second. Keeps motion visible without feeling frantic. */
export const SIM_SPEED = 6;

type Measured = { coords: LngLat[]; cum: number[]; total: number; duration: number };

const R = 6371000;
function dist(a: LngLat, b: LngLat) {
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLng = (b[0] - a[0]) * toRad;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function measure(r: Route): Measured {
  const cum = [0];
  for (let i = 1; i < r.coords.length; i++) cum.push(cum[i - 1] + dist(r.coords[i - 1], r.coords[i]));
  return { coords: r.coords, cum, total: cum[cum.length - 1], duration: r.duration };
}

export const MEASURED = Object.fromEntries(
  Object.entries(ROUTES).map(([k, r]) => [k, measure(r)]),
) as Record<keyof typeof ROUTES, Measured>;

function bearing(a: LngLat, b: LngLat) {
  const toRad = Math.PI / 180;
  const y = Math.sin((b[0] - a[0]) * toRad) * Math.cos(b[1] * toRad);
  const x =
    Math.cos(a[1] * toRad) * Math.sin(b[1] * toRad) -
    Math.sin(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.cos((b[0] - a[0]) * toRad);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** Position, heading and index at a fraction of the route. */
export function pointAt(m: Measured, frac: number): { pos: LngLat; heading: number; index: number } {
  const d = Math.min(Math.max(frac, 0), 1) * m.total;
  let i = 1;
  while (i < m.cum.length - 1 && m.cum[i] < d) i++;
  const a = m.coords[i - 1];
  const b = m.coords[i];
  const seg = m.cum[i] - m.cum[i - 1] || 1;
  const t = (d - m.cum[i - 1]) / seg;
  return { pos: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], heading: bearing(a, b), index: i };
}

/** Split a route at a fraction into driven / remaining polylines. */
export function splitAt(m: Measured, frac: number) {
  const { pos, index } = pointAt(m, frac);
  return {
    driven: [...m.coords.slice(0, index), pos] as LngLat[],
    remaining: [pos, ...m.coords.slice(index)] as LngLat[],
  };
}

export type UnitLive = {
  id: string;
  status: UnitStatus;
  pos: LngLat;
  heading: number;
  routeKey: keyof typeof ROUTES | null;
  progress: number; // 0..1 along routeKey
};

export type SimApi = ReturnType<typeof useDispatchSim>;

/**
 * Local simulation. Positions live in a ref and advance every animation frame
 * (the map reads the ref directly); React state ticks at 4 Hz for text.
 */
export function useDispatchSim() {
  const startRef = useRef(0);
  const liveRef = useRef<Record<string, UnitLive>>(
    Object.fromEntries(
      UNITS.map((u) => {
        if (u.id === "amb-3") {
          const p = pointAt(MEASURED.m3_transport, 0.35);
          return [u.id, { id: u.id, status: "transporting", pos: p.pos, heading: p.heading, routeKey: "m3_transport", progress: 0.35 }];
        }
        return [u.id, { id: u.id, status: "available", pos: u.home, heading: 0, routeKey: null, progress: 0 }];
      }),
    ) as Record<string, UnitLive>,
  );
  const [elapsed, setElapsed] = useState(0);
  const [units, setUnits] = useState<UnitLive[]>([]);
  const publish = useCallback(() => setUnits(Object.values(liveRef.current).map((u) => ({ ...u }))), []);

  useEffect(() => {
    startRef.current = performance.now();
    let last = startRef.current;
    let raf = 0;
    let lastTick = 0;
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      for (const u of Object.values(liveRef.current)) {
        if (!u.routeKey) continue;
        const m = MEASURED[u.routeKey];
        u.progress += (dt * SIM_SPEED) / m.duration;
        if (u.progress >= 1) {
          if (u.status === "transporting") u.progress = 0; // loop the transport so the demo stays alive
          else {
            u.progress = 1;
            u.status = "on_scene";
          }
        }
        const p = pointAt(m, u.progress);
        u.pos = p.pos;
        u.heading = p.heading;
        if (u.status === "on_scene") u.routeKey = null;
      }
      if (now - lastTick > 250) {
        lastTick = now;
        setElapsed((now - startRef.current) / 1000);
        publish();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [publish]);

  const dispatch = useCallback((unitId: string, routeKey: keyof typeof ROUTES) => {
    const u = liveRef.current[unitId];
    if (u.status === "transporting") return; // queued, keeps current job
    u.status = "en_route";
    u.routeKey = routeKey;
    u.progress = 0;
    publish();
  }, [publish]);

  const getLive = useCallback(() => liveRef.current, []);

  return { getLive, elapsed, units, dispatch };
}

/** Minutes left on a unit's current route at sim speed (road time, not wall time). */
export function minutesLeft(u: UnitLive) {
  if (!u.routeKey) return 0;
  return Math.max(0, Math.round(((1 - u.progress) * MEASURED[u.routeKey].duration * 0.72) / 60));
}
