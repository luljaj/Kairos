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
        padding: wide ? { top: 90, bottom: 90, left: 410, right: 450 } : 50,
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
          cameraKey.current = "overview";
          frame(map, [
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
          pitch: 40,
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
          },
        });
        setReady(true);
        setError(null);
      });
      const activeMarkers = markers.current;
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
            icon.textContent = "+";
            element.append(icon);
            const text = document.createElement("span");
            text.className = "dm-unit-label";
            element.append(text);
            element.onclick = () => latest.current.onSelectUnit(id);
          } else if (kind === "incident") {
            const core = document.createElement("span");
            core.className = "dm-incident-core";
            element.append(core);
            element.onclick = () => latest.current.onSelectCall(id);
          } else {
            const icon = document.createElement("span");
            icon.className = "dm-hospital-icon";
            icon.textContent = "+";
            element.append(icon);
            const text = document.createElement("span");
            text.className = "dm-hospital-label";
            element.append(text);
          }
          marker = new mapboxgl.Marker({ element })
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
            kind === "unit" ? state!.ambulances[id].name : label;
        marker.setLngLat(point(coords));
      }
      Object.values(state.ambulances).forEach((unit) =>
        mark(
          unit.id,
          unit.position,
          "unit",
          `${unit.name} · ${unitStatus(unit, state)}`,
          unit.status,
        ),
      );
      Object.values(state.calls).forEach((call) => {
        if (call.location.coords && call.status !== "closed")
          mark(
            call.id,
            call.location.coords,
            "incident",
            `${callTitle(call)} · ${call.location.text ?? "Incident"}`,
          );
      });
      state.hospitals.forEach((hospital) =>
        mark(hospital.id, hospital.coords, "hospital", hospital.name),
      );
      for (const [id, marker] of markers.current)
        if (!retained.has(id)) {
          marker.remove();
          markers.current.delete(id);
        }
      const routes = {
        type: "FeatureCollection" as const,
        features: Object.values(state.tasks)
          .filter(
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
        focus,
      ]);
      if (key !== cameraKey.current) {
        cameraKey.current = key;
        frame(
          map,
          focus.length
            ? focus
            : Object.values(state.ambulances).map((unit) =>
                point(unit.position),
              ),
        );
      }
    }, [props, ready]);

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
