"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { CALLS, HOSPITALS, UNITS, unitById, type LngLat, type TriageOption } from "@/lib/dispatch-mock/data";
import { MEASURED, splitAt, type SimApi } from "@/lib/dispatch-mock/sim";

export type Padding = { top: number; right: number; bottom: number; left: number };

export type DispatchMapHandle = { overview: () => void };

type Props = {
  sim: SimApi;
  trackedId: string | null;
  proposal: TriageOption | null;
  padding: Padding;
  onSelectUnit: (id: string | null) => void;
};

const OVERVIEW = { center: [-75.948, 42.0985] as LngLat, zoom: 12.85, pitch: 58, bearing: -22 };
const INTRO = { center: [-75.948, 42.0985] as LngLat, zoom: 11.2, pitch: 0, bearing: 0 };

const EMPTY = { type: "FeatureCollection" as const, features: [] };

const line = (coords: LngLat[], props: Record<string, unknown> = {}) => ({
  type: "Feature" as const,
  properties: props,
  geometry: { type: "LineString" as const, coordinates: coords },
});

/** Exponential approach — frame-rate independent, critically damped feel, interruptible by construction. */
const approach = (from: number, to: number, dt: number, response = 0.45) =>
  from + (to - from) * (1 - Math.exp(-dt / response));

const angleDelta = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

/** Mapbox Standard at dusk, monochrome, no POI clutter, 3D buildings on. */
const BASEMAP: Record<string, string | boolean> = {
  lightPreset: "dusk",
  theme: "monochrome",
  showPointOfInterestLabels: false,
  showTransitLabels: false,
  showPedestrianRoads: false,
  show3dObjects: true,
};

export const DispatchMap = forwardRef<DispatchMapHandle, Props>(function DispatchMap(
  { sim, trackedId, proposal, padding, onSelectUnit },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const readyRef = useRef(false);
  const markersRef = useRef<Record<string, { marker: mapboxgl.Marker; arrow: HTMLElement; el: HTMLElement }>>({});
  const etaMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // Latest props for the animation loop without re-subscribing.
  const live = useRef({ trackedId, padding, onSelectUnit, proposal });
  live.current = { trackedId, padding, onSelectUnit, proposal };
  const lastInteraction = useRef(0);

  useImperativeHandle(ref, () => ({
    overview: () => {
      mapRef.current?.easeTo({ ...OVERVIEW, padding: live.current.padding, duration: 1100, easing: easeOutQuint });
    },
  }));

  // --- Map lifecycle ---------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      accessToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
      style: "mapbox://styles/mapbox/standard",
      ...INTRO,
      antialias: true,
      attributionControl: false,
      logoPosition: "bottom-right",
    });
    mapRef.current = map;
    map.on("error", (e) => {
      const err = e.error as (Error & { status?: number; url?: string }) | undefined;
      if (err?.name === "AbortError") return;
      console.error("[map]", err?.message, err?.status, err?.url);
    });

    map.on("style.load", () => {
      const slot = { slot: "top" as const };
      for (const [k, v] of Object.entries(BASEMAP)) map.setConfigProperty("basemap", k, v);
      // Standard drapes lines on terrain but HTML markers sit at sea level — keep both on one plane.
      map.setTerrain(null);

      // Overlay sources
      map.addSource("trails", { type: "geojson", data: EMPTY, lineMetrics: true });
      map.addSource("active", { type: "geojson", data: EMPTY, lineMetrics: true });
      map.addSource("proposal", { type: "geojson", data: EMPTY, lineMetrics: true });

      map.addLayer({
        id: "proposal-glow",
        type: "line",
        source: "proposal",
        ...slot,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 14,
          "line-blur": 10,
          "line-opacity": 0.35,
          "line-trim-offset": [0, 0],
        },
      });
      map.addLayer({
        id: "proposal-line",
        type: "line",
        source: "proposal",
        ...slot,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 3.5,
          "line-trim-offset": [0, 0],
          "line-emissive-strength": 1,
        },
      });
      map.addLayer({
        id: "active-line",
        type: "line",
        source: "active",
        ...slot,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": 2,
          "line-opacity": 0.8,
          "line-dasharray": [1.2, 1.8],
          "line-emissive-strength": 1,
        },
      });
      map.addLayer({
        id: "trail-line",
        type: "line",
        source: "trails",
        ...slot,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-width": 4,
          "line-gradient": [
            "interpolate",
            ["linear"],
            ["line-progress"],
            0,
            "rgba(255,255,255,0)",
            1,
            "rgba(255,255,255,0.85)",
          ],
          "line-emissive-strength": 1,
        },
      });

      readyRef.current = true;

      // God's-eye entrance: settle from straight-down into the tilted city view.
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      map.easeTo({ ...OVERVIEW, padding: live.current.padding, duration: reduce ? 0 : 2400, easing: easeOutQuint });
    });

    const markInteraction = (e: object) => {
      if (!("originalEvent" in e) || !e.originalEvent) return;
      lastInteraction.current = performance.now();
    };
    // Dragging the map hands the camera back to the operator.
    map.on("dragstart", (e) => {
      markInteraction(e);
      if (e.originalEvent && live.current.trackedId) live.current.onSelectUnit(null);
    });
    map.on("rotatestart", markInteraction);
    map.on("pitchstart", markInteraction);
    map.on("wheel", markInteraction);

    return () => {
      readyRef.current = false;
      Object.values(markersRef.current).forEach((m) => m.marker.remove());
      markersRef.current = {};
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // --- Markers (created once) ------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const u of UNITS) {
      const el = document.createElement("button");
      el.className = "dm-unit";
      el.setAttribute("aria-label", `Track ${u.name}`);
      el.innerHTML = `<span class="dm-unit-ring"></span><span class="dm-unit-arrow"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 3 19 20 12 16 5 20Z" fill="currentColor"/></svg></span><span class="dm-unit-label">${u.name.replace("Medic ", "M")}</span>`;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        live.current.onSelectUnit(u.id);
      });
      const marker = new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat(u.home).addTo(map);
      markersRef.current[u.id] = { marker, el, arrow: el.querySelector(".dm-unit-arrow") as HTMLElement };
    }
    for (const c of CALLS.filter((c) => c.stage !== "assigned")) {
      const el = document.createElement("div");
      el.className = "dm-incident";
      el.dataset.tone = c.acuity === "Delta" || c.acuity === "Echo" ? "critical" : "urgent";
      el.innerHTML = `<span class="dm-incident-pulse"></span><span class="dm-incident-core"></span>`;
      new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat(c.coords).addTo(map);
    }
    for (const hosp of HOSPITALS) {
      const h = document.createElement("div");
      h.className = "dm-hospital";
      h.title = hosp.name;
      h.innerHTML = `<span class="dm-hospital-icon"><svg viewBox="0 0 16 16" width="10" height="10"><path d="M6 2h4v4h4v4h-4v4H6v-4H2V6h4z" fill="currentColor"/></svg></span><span class="dm-hospital-label">${hosp.short}</span>`;
      new mapboxgl.Marker({ element: h, anchor: "left", offset: [-11, 0] }).setLngLat(hosp.coords).addTo(map);
    }
  }, []);

  // --- Proposal route: draw-on reveal + frame it from above ------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    etaMarkerRef.current?.remove();
    etaMarkerRef.current = null;
    let raf = 0;

    const apply = () => {
      const src = map.getSource("proposal") as mapboxgl.GeoJSONSource | undefined;
      if (!src) return;
      if (!proposal) {
        src.setData(EMPTY);
        return;
      }
      const m = MEASURED[proposal.routeKey];
      const color = proposal.verdict === "mismatch" ? "#f2c46d" : "#ffffff";
      src.setData({ type: "FeatureCollection", features: [line(m.coords, { color })] });

      // Reveal from origin to scene. Trim range is the part hidden.
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const start = performance.now();
      const D = reduce ? 0 : 900;
      const tick = (now: number) => {
        const t = D ? Math.min(Math.max((now - start) / D, 0), 1) : 1;
        const p = easeOutQuint(t);
        const trim: [number, number] = p >= 1 ? [0, 0] : [p, 1];
        map.setPaintProperty("proposal-line", "line-trim-offset", trim);
        map.setPaintProperty("proposal-glow", "line-trim-offset", trim);
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      // ETA tag at the route's midpoint
      const mid = m.coords[Math.floor(m.coords.length / 2)];
      const el = document.createElement("div");
      el.className = "dm-eta";
      const u = unitById(proposal.unitId);
      el.innerHTML = `<span>${u.name}</span><strong>${proposal.etaMin + (proposal.waitMin ?? 0)} min</strong>`;
      etaMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "bottom", offset: [0, -10] })
        .setLngLat(mid)
        .addTo(map);

      if (!live.current.trackedId) {
        const b = new mapboxgl.LngLatBounds();
        m.coords.forEach((c) => b.extend(c));
        const pad = live.current.padding;
        map.fitBounds(b, {
          padding: { top: pad.top + 80, right: pad.right + 80, bottom: pad.bottom + 80, left: pad.left + 80 },
          pitch: 48,
          bearing: map.getBearing(),
          duration: reduce ? 0 : 1000,
          easing: easeOutQuint,
        });
      }
    };

    if (readyRef.current) apply();
    else map.once("style.load", () => requestAnimationFrame(apply));
    return () => cancelAnimationFrame(raf);
  }, [proposal]);

  // --- Per-frame: move markers, update lines, follow camera -----------------
  const { getLive } = sim;
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      frame++;
      const map = mapRef.current;
      if (map && readyRef.current) {
        const bearing = map.getBearing();
        const units = Object.values(getLive());
        for (const u of units) {
          const m = markersRef.current[u.id];
          if (!m) continue;
          m.marker.setLngLat(u.pos);
          m.arrow.style.transform = `rotate(${u.heading - bearing}deg)`;
          m.el.dataset.status = u.status;
          m.el.dataset.tracked = String(live.current.trackedId === u.id);
        }

        if (frame % 2 === 0) {
          const active = [];
          const trails = [];
          for (const u of units) {
            if (!u.routeKey) continue;
            const { driven, remaining } = splitAt(MEASURED[u.routeKey], u.progress);
            active.push(line(remaining, { id: u.id }));
            trails.push(line(driven.slice(-60), { id: u.id }));
          }
          (map.getSource("active") as mapboxgl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: active });
          (map.getSource("trails") as mapboxgl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: trails });
        }

        const tracked = live.current.trackedId ? getLive()[live.current.trackedId] : null;
        if (tracked && !map.isEasing()) {
          const c = map.getCenter();
          const moving = !!tracked.routeKey;
          const targetBearing = moving ? tracked.heading : bearing;
          map.jumpTo({
            center: [approach(c.lng, tracked.pos[0], dt, 0.35), approach(c.lat, tracked.pos[1], dt, 0.35)],
            zoom: approach(map.getZoom(), 16.4, dt, 0.6),
            pitch: approach(map.getPitch(), 64, dt, 0.6),
            bearing: bearing + angleDelta(bearing, targetBearing) * (1 - Math.exp(-dt / 1.2)),
            padding: live.current.padding,
          });
        } else if (
          !tracked &&
          !live.current.proposal &&
          !map.isMoving() &&
          now - lastInteraction.current > 6000 &&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          map.setBearing(bearing + dt * 1.2);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [getLive]);

  // Release a camera that was framing a proposal when tracking ends.
  useEffect(() => {
    if (trackedId) lastInteraction.current = performance.now();
  }, [trackedId]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="size-full" />
    </div>
  );
});

function easeOutQuint(t: number) {
  return 1 - Math.pow(1 - t, 5);
}
