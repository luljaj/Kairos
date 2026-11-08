"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { DispatchState, LatLng } from "@/lib/contracts";
import { callTitle, unitStatus } from "@/lib/client/dispatch-view";
import { distance, measure, pointAt } from "@/lib/simulation/geometry";

export type DispatchMapHandle = { overview: () => void };
type Props = {
  state: DispatchState | null;
  selectedCallId: string | null;
  candidateId: string | null;
  trackedId: string | null;
  onSelectUnit: (id: string | null) => void;
  onSelectCall: (id: string) => void;
};
const point = ({ lat, lng }: LatLng): [number, number] => [lng, lat];
const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export const DispatchMap = forwardRef<DispatchMapHandle, Props>(
  function DispatchMap(props, ref) {
    const container = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markers = useRef(new Map<string, mapboxgl.Marker>());
    const latest = useRef(props);
    const cameraKey = useRef("");
    const motion = useRef(new Map<string, {
      geometry: ReturnType<typeof measure>;
      from: number;
      to: number;
      rendered: number;
      received: number;
      key: string;
    }>());
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(
      token
        ? null
        : "Map unavailable · incident and fleet controls remain connected.",
    );
    useEffect(() => {
      latest.current = props;
    }, [props]);

    function frame(map: mapboxgl.Map, points: [number, number][]) {
      if (!points.length) return;
      const bounds = new mapboxgl.LngLatBounds();
      points.forEach((coords) => bounds.extend(coords));
      const wide = map.getContainer().clientWidth > 900;
      map.fitBounds(bounds, {
        padding: wide ? { top: 90, bottom: Math.min(380, map.getContainer().clientHeight * 0.5), left: 410, right: 50 } : 50,
        maxZoom: 14,
        pitch: 40,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 700,
      });
    }
    useImperativeHandle(
      ref,
      () => ({
        overview() {
          const map = mapRef.current;
          const state = latest.current.state;
          if (!map || !state) return;
          cameraKey.current = JSON.stringify([null, latest.current.candidateId, latest.current.selectedCallId]);
          latest.current.onSelectUnit(null);
          frame(map, [
            ...state.hospitals.map((hospital) => point(hospital.coords)),
            ...Object.values(state.ambulances).map((unit) =>
              point(unit.position),
            ),
            ...Object.values(state.calls).flatMap((call) =>
              call.location.coords ? [point(call.location.coords)] : [],
            ),
          ]);
        },
      }),
      [],
    );

    useEffect(() => {
      if (!container.current || !token) return;
      let map: mapboxgl.Map;
      try {
        map = new mapboxgl.Map({
          container: container.current,
          accessToken: token,
          style: "mapbox://styles/mapbox/standard",
          center: [-75.948, 42.0985],
          zoom: 12.5,
          pitch: 58,
          bearing: -22,
          logoPosition: "bottom-right",
        });
      } catch {
        // Map construction can fail on machines without WebGL.
        const timer = setTimeout(
          () =>
            setError(
              "Map unavailable · incident and fleet controls remain connected.",
            ),
          0,
        );
        return () => clearTimeout(timer);
      }
      mapRef.current = map;
      map.on("error", () =>
        setError(
          "Map tiles unavailable · incident and fleet controls remain connected.",
        ),
      );
      map.on("load", () => {
        map.setConfigProperty("basemap", "lightPreset", "dusk");
        map.setConfigProperty("basemap", "theme", "monochrome");
        map.setConfigProperty("basemap", "showPointOfInterestLabels", false);
        map.setConfigProperty("basemap", "showTransitLabels", false);
        map.setConfigProperty("basemap", "showPedestrianRoads", false);
        map.setConfigProperty("basemap", "show3dObjects", true);
        map.setTerrain(null);
        map.addSource("task-routes", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "task-routes",
          type: "line",
          source: "task-routes",
          slot: "top",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-width": 3,
            "line-opacity": 0.8,
            "line-dasharray": [1.2, 1.8],
            "line-emissive-strength": 1,
          },
        });
        map.addSource("proposal", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "proposal-line", type: "line", source: "proposal", slot: "top",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#f2c46d", "line-width": 3.5, "line-emissive-strength": 1 },
        });
        setReady(true);
        setError(null);
      });
      const activeMarkers = markers.current;
      map.on("dragstart", (event) => {
        if (event.originalEvent) latest.current.onSelectUnit(null);
      });
      return () => {
        activeMarkers.forEach((marker) => marker.remove());
        activeMarkers.clear();
        map.remove();
        mapRef.current = null;
      };
    }, []);

    useEffect(() => {
      const map = mapRef.current;
      const { state, trackedId, candidateId, selectedCallId } = props;
      if (!map || !ready || !state) return;
      const retained = new Set<string>();
      function mark(
        id: string,
        coords: LatLng,
        kind: "unit" | "incident" | "hospital",
        label: string,
        status?: string,
      ) {
        retained.add(id);
        let marker = markers.current.get(id);
        if (!marker) {
          const element = document.createElement(
            kind === "hospital" ? "div" : "button",
          );
          element.className = `dm-${kind}`;
          if (kind === "unit") {
            const ring = document.createElement("span");
            ring.className = "dm-unit-ring";
            element.append(ring);
            const icon = document.createElement("span");
            icon.className = "dm-unit-arrow";
            icon.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 3 19 20 12 16 5 20Z" fill="currentColor"/></svg>';
            element.append(icon);
            const text = document.createElement("span");
            text.className = "dm-unit-label";
            element.append(text);
            element.onclick = () => latest.current.onSelectUnit(id);
          } else if (kind === "incident") {
            const pulse = document.createElement("span");
            pulse.className = "dm-incident-pulse";
            element.append(pulse);
            const core = document.createElement("span");
            core.className = "dm-incident-core";
            element.append(core);
            element.onclick = () => latest.current.onSelectCall(id);
          } else {
            const icon = document.createElement("span");
            icon.className = "dm-hospital-icon";
            icon.innerHTML = '<svg viewBox="0 0 16 16" width="10" height="10"><path d="M6 2h4v4h4v4h-4v4H6v-4H2V6h4z" fill="currentColor"/></svg>';
            element.append(icon);
            const text = document.createElement("span");
            text.className = "dm-hospital-label";
            element.append(text);
          }
          marker = new mapboxgl.Marker({ element, anchor: kind === "hospital" ? "left" : "center", offset: kind === "hospital" ? [-11, 0] : [0, 0] })
            .setLngLat(point(coords))
            .addTo(map!);
          markers.current.set(id, marker);
        }
        const element = marker.getElement();
        element.title = label;
        element.setAttribute("aria-label", label);
        element.dataset.status = status;
        element.dataset.tracked = String(
          trackedId === id || candidateId === id,
        );
        const text = element.querySelector(
          kind === "unit" ? ".dm-unit-label" : ".dm-hospital-label",
        );
        if (text)
          text.textContent =
            kind === "unit" ? state!.ambulances[id].name.replace("Medic ", "M") : label;
        if (kind !== "unit" || !motion.current.has(id)) marker.setLngLat(point(coords));
      }
      const units = Object.values(state.ambulances);
      const home = units[0]?.homeStation;
      const parked = home ? units.filter((unit) =>
        !unit.activeTaskId && !unit.returnTrip && unit.status === "available"
        && distance(point(unit.position), point(home)) < 20,
      ) : [];
      const groupedIds = new Set(parked.length >= 2 ? parked.map((unit) => unit.id) : []);
      if (home) {
        const stationId = "hf-squadroom";
        retained.add(stationId);
        let station = markers.current.get(stationId);
        if (!station) {
          const element = document.createElement("div");
          element.className = "dm-station";
          const button = document.createElement("button");
          button.type = "button";
          button.className = "dm-station-button";
          button.setAttribute("aria-controls", "squadroom-units");
          button.setAttribute("aria-expanded", "false");
          const list = document.createElement("div");
          list.id = "squadroom-units";
          list.className = "dm-station-units";
          list.hidden = true;
          button.onclick = () => {
            list.hidden = !list.hidden;
            button.setAttribute("aria-expanded", String(!list.hidden));
          };
          element.onkeydown = (event) => {
            if (event.key === "Escape") {
              list.hidden = true;
              button.setAttribute("aria-expanded", "false");
              button.focus();
            }
          };
          element.append(button, list);
          station = new mapboxgl.Marker({ element, anchor: "bottom", offset: [0, -18] })
            .setLngLat(point(home)).addTo(map);
          markers.current.set(stationId, station);
        }
        station.setLngLat(point(home));
        const element = station.getElement();
        const button = element.querySelector<HTMLButtonElement>(".dm-station-button")!;
        const list = element.querySelector<HTMLDivElement>(".dm-station-units")!;
        button.textContent = groupedIds.size ? `HF squadroom · ${parked.length} cars` : "HF squadroom";
        button.title = "Harpur’s Ferry squadroom · East Access Road";
        button.disabled = !groupedIds.size;
        element.dataset.tracked = String(parked.some((unit) => unit.id === trackedId || unit.id === candidateId));
        if (!groupedIds.size) {
          list.hidden = true;
          button.setAttribute("aria-expanded", "false");
        }
        const groupKey = [...groupedIds].join(",");
        if (element.dataset.units !== groupKey) {
          element.dataset.units = groupKey;
          list.replaceChildren(...parked.filter((unit) => groupedIds.has(unit.id)).map((unit) => {
            const choice = document.createElement("button");
            choice.type = "button";
            choice.dataset.unitId = unit.id;
            choice.textContent = `${unit.name} · Available`;
            choice.onclick = () => {
              latest.current.onSelectUnit(unit.id);
              list.hidden = true;
              button.setAttribute("aria-expanded", "false");
              button.focus();
            };
            return choice;
          }));
        }
        list.querySelectorAll<HTMLButtonElement>("button").forEach((choice) => {
          choice.setAttribute("aria-pressed", String(choice.dataset.unitId === trackedId));
        });
      }
      units.forEach((unit) => {
        if (groupedIds.has(unit.id)) {
          motion.current.delete(unit.id);
          return;
        }
        const task = unit.activeTaskId ? state.tasks[unit.activeTaskId] : null;
        const route = task?.route ?? unit.returnTrip?.route;
        const endsAt = task?.phaseEndsAt ?? unit.returnTrip?.endsAt;
        if (route && route.geometry.length > 1 && endsAt && task?.phase !== "on_scene") {
          const key = `${task?.id ?? unit.id}:${task?.phase ?? "returning"}:${endsAt}`;
          const previous = motion.current.get(unit.id);
          const progress = Math.max(0, Math.min(1, 1 - (Date.parse(endsAt) - Date.parse(state.simClock)) / (Math.max(1, route.durationSeconds) * 1000)));
          motion.current.set(unit.id, {
            geometry: previous?.key === key ? previous.geometry : measure(route.geometry),
            from: previous?.key === key ? previous.rendered : progress,
            to: progress, rendered: previous?.key === key ? previous.rendered : progress,
            received: performance.now(), key,
          });
        } else motion.current.delete(unit.id);
        mark(
          unit.id,
          unit.position,
          "unit",
          `${unit.name} · ${unitStatus(unit, state)}`,
          task?.phase ?? unit.status,
        );
      });
      Object.values(state.calls).forEach((call) => {
        if (call.location.coords && call.status !== "closed") {
          mark(
            call.id,
            call.location.coords,
            "incident",
            `${callTitle(call)} · ${call.location.text ?? "Incident"}`,
          );
          const element = markers.current.get(call.id)?.getElement();
          if (element) element.dataset.tone = call.acuity?.value === "Delta" || call.acuity?.value === "Echo" ? "critical" : "urgent";
        }
      });
      state.hospitals.forEach((hospital) =>
        mark(hospital.id, hospital.coords, "hospital", hospital.name),
      );
      for (const [id, marker] of markers.current)
        if (!retained.has(id)) {
          marker.remove();
          markers.current.delete(id);
          motion.current.delete(id);
        }
      const routes = {
        type: "FeatureCollection" as const,
        features: [
          ...units.flatMap((unit) => unit.returnTrip?.route ? [{ id: `return:${unit.id}`, status: "active", route: unit.returnTrip.route }] : []),
          ...Object.values(state.tasks),
        ].filter(
            (task) =>
              task.status === "active" &&
              task.route &&
              task.route.geometry.length > 1,
          )
          .map((task) => ({
            type: "Feature" as const,
            properties: { id: task.id },
            geometry: {
              type: "LineString" as const,
              coordinates: task.route!.geometry,
            },
          })),
      };
      (
        map.getSource("task-routes") as mapboxgl.GeoJSONSource | undefined
      )?.setData(routes);
      const unit = state.ambulances[trackedId ?? candidateId ?? ""];
      const call = selectedCallId ? state.calls[selectedCallId] : null;
      const focus = [
        ...(unit ? [point(unit.position)] : []),
        ...(!trackedId && call?.location.coords
          ? [point(call.location.coords)]
          : []),
      ];
      const key = JSON.stringify([
        trackedId,
        candidateId,
        selectedCallId,
        // Moving snapshots must not restart fitBounds on every simulation tick.
      ]);
      if (key !== cameraKey.current) {
        cameraKey.current = key;
        frame(
          map,
          focus.length
            ? focus
            : [
                ...Object.values(state.ambulances).map((unit) => point(unit.position)),
                ...state.hospitals.map((hospital) => point(hospital.coords)),
              ],
        );
      }
    }, [props, ready]);

    useEffect(() => {
      if (!ready) return;
      let raf = 0;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      const loop = (now: number) => {
        const map = mapRef.current;
        if (!map) return;
        for (const [id, sample] of motion.current) {
          const marker = markers.current.get(id);
          if (!marker) continue;
          const t = reduced.matches ? 1 : Math.min(1, (now - sample.received) / 250);
          sample.rendered = sample.from + (sample.to - sample.from) * t;
          const current = pointAt(sample.geometry, sample.rendered);
          marker.setLngLat(current.pos);
          const arrow = marker.getElement().querySelector<HTMLElement>(".dm-unit-arrow");
          if (arrow) arrow.style.transform = `rotate(${current.heading - map.getBearing()}deg)`;
        }
        const tracked = latest.current.trackedId;
        const marker = tracked ? markers.current.get(tracked) : null;
        if (marker && !map.isMoving()) map.jumpTo({ center: marker.getLngLat() });
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }, [ready]);

    const previewCall = props.selectedCallId ? props.state?.calls[props.selectedCallId] : null;
    const previewKey = JSON.stringify([props.candidateId, previewCall?.id, previewCall?.location.coords, props.state?.fleetRevision]);
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !ready) return;
      const source = map.getSource("proposal") as mapboxgl.GeoJSONSource | undefined;
      source?.setData({ type: "FeatureCollection", features: [] });
      const { candidateId, selectedCallId, trackedId, state } = latest.current;
      if (!candidateId || !selectedCallId || trackedId || state?.calls[selectedCallId]?.taskId) return;
      const controller = new AbortController();
      void fetch(`/api/routes?ambulanceId=${encodeURIComponent(candidateId)}&callId=${encodeURIComponent(selectedCallId)}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : null)
        .then((route) => {
          if (!route || controller.signal.aborted) return;
          source?.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route.geometry } });
        }).catch(() => {});
      return () => controller.abort();
    }, [previewKey, props.trackedId, previewCall?.taskId, ready]);

    return (
      <div className="dispatch-map" aria-label="Incident and fleet map">
        <div ref={container} className="absolute inset-0" />
        {error && (
          <p role="status" className="map-notice">
            {error}
          </p>
        )}
      </div>
    );
  },
);
