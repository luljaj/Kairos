/**
 * Travel time between two points. Uses the road duration of a route `routing.ts` already
 * fetched for that exact pair, else a straight-line estimate. Sync on purpose: ranking and
 * ETA code is sync, so roads are fetched ahead of time (`warmRoutes`) and read here.
 */
import type { LatLng } from "@/lib/contracts";
import { coordinates, distance } from "@/lib/simulation/geometry";

/** Straight line × 1.4 (road detour) at 40 km/h. */
export function estimateTravelSeconds(from: LatLng, to: LatLng): number {
  return Math.ceil(distance(coordinates(from), coordinates(to)) * 1.4 / (40_000 / 3_600));
}

const MAX = 500;
const roadSeconds = new Map<string, number>();

export const pairKey = (from: LatLng, to: LatLng) => JSON.stringify([coordinates(from), coordinates(to)]);

export function rememberRoadSeconds(from: LatLng, to: LatLng, seconds: number): void {
  const key = pairKey(from, to);
  roadSeconds.delete(key);
  if (roadSeconds.size >= MAX) roadSeconds.delete(roadSeconds.keys().next().value!);
  roadSeconds.set(key, seconds);
}

export function travelSeconds(from: LatLng, to: LatLng): number {
  return roadSeconds.get(pairKey(from, to)) ?? estimateTravelSeconds(from, to);
}
