import { Route, type DispatchState, type LatLng } from "@/lib/contracts";
import savedRoutes from "@/fixtures/demo-routes.json";
import { coordinates, distance, type LngLat } from "@/lib/simulation/geometry";
import { estimateAvailability, nearestHospital } from "./eta";
import { estimateTravelSeconds, rememberRoadSeconds } from "./travel";

const cache = new Map<string, Route>();

/** Directions for arbitrary incident locations, with the original demo's road routes as a cache. */
export async function getRoute(from: LatLng, to: LatLng): Promise<Route> {
  const start = coordinates(from), end = coordinates(to);
  const key = JSON.stringify([start, end]);
  const cached = cache.get(key);
  if (cached) return structuredClone(cached);
  const saved = Object.values(savedRoutes).find((r) =>
    distance(start, r.coords[0] as LngLat) < 100
    && distance(end, r.coords.at(-1) as LngLat) < 100,
  );
  let route: Route | undefined;
  if (saved) route = {
    geometry: [start, ...saved.coords as LngLat[], end],
    durationSeconds: saved.duration, distanceMeters: saved.distance, estimated: false,
  };
  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!route && token) {
    try {
      const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${start.join(",")};${end.join(",")}`);
      url.search = new URLSearchParams({ access_token: token, geometries: "geojson", overview: "full" }).toString();
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error("Directions unavailable");
      const body = await response.json();
      const result = body.routes?.[0];
      route = Route.parse({
        geometry: result?.geometry?.coordinates, durationSeconds: result?.duration,
        distanceMeters: result?.distance, estimated: false,
      });
      if (route.geometry.length < 2) throw new Error("Empty route");
      // Preserve the actual incident/campus point beyond the snapped road endpoint.
      route.geometry = [start, ...route.geometry, end];
    } catch {
      // Do not log URLs containing access tokens. The UI labels estimated routes.
      console.warn("[routing] Directions unavailable; using estimated route");
      route = undefined;
    }
  }
  route ??= {
    geometry: [start, end], durationSeconds: Math.max(1, estimateTravelSeconds(from, to)),
    distanceMeters: distance(start, end), estimated: true,
  };
  if (!route.estimated) {
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, route);
    // Ranking and ETAs read this, so they match the line the unit actually drives.
    rememberRoadSeconds(from, to, route.durationSeconds);
  }
  return structuredClone(route);
}

/**
 * Fetch road routes for an incident ahead of ranking: every selectable unit's release point
 * -> incident, and incident -> nearest hospital. Fills the travel-time cache and the route
 * cache, so the accepted task reuses the same route. Never throws (getRoute has fallbacks).
 */
export async function warmRoutes(state: DispatchState, incident: LatLng): Promise<void> {
  const pairs: [LatLng, LatLng][] = [];
  for (const unit of Object.values(state.ambulances)) {
    const from = estimateAvailability(state, unit).releasePoint;
    if (from) pairs.push([from, incident]);
  }
  const hospital = nearestHospital(state, incident);
  if (hospital) pairs.push([incident, hospital.coords]);
  await Promise.all(pairs.map(([from, to]) => getRoute(from, to)));
}
