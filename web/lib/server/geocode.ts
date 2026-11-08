/**
 * Caller's location text -> coordinates, via the Mapbox Search Box API (`/forward`).
 * Search Box rather than Geocoding v6: it also resolves places ("Bartle Library",
 * "Lourdes Hospital"), which is how callers describe a location.
 */
import type { LatLng } from "@/lib/contracts";

export type Geocoded = {
  coords: LatLng;
  confidence: "confirmed" | "approximate";
  /** What Mapbox matched, for logs and read-back. */
  label: string;
};

/** Broome County, NY, with margin. Results outside are rejected. */
const BBOX = "-76.13,41.99,-75.40,42.42";
const PROXIMITY = "-75.96,42.09"; // Binghamton / BU campus

// Precise enough to drive to.
const EXACT = new Set(["poi", "address"]);
// Usable, but the agent should confirm with the caller.
const NEAR = new Set(["street", "block", "neighborhood"]);
// Anything else (place, locality, postcode, region…) is a whole town: reject.

const cache = new Map<string, Geocoded | null>();

export async function geocodeLocation(text: string): Promise<Geocoded | null> {
  const query = text.trim().replace(/\s+/g, " ");
  if (!query) return null;
  const key = query.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    console.warn("[geocode] no Mapbox token");
    return null;
  }
  let result: Geocoded | null = null;
  try {
    result = await lookup(query, token);
  } catch (error) {
    // Don't cache failures (network blips); don't log the URL (it holds the token).
    console.warn("[geocode] lookup failed:", error instanceof Error ? error.message : error);
    return null;
  }
  console.log(`[geocode] "${query}" -> ${result ? `${result.label} (${result.confidence})` : "no usable match"}`);
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}

async function lookup(q: string, token: string): Promise<Geocoded | null> {
  const url = new URL("https://api.mapbox.com/search/searchbox/v1/forward");
  url.search = new URLSearchParams({
    q, access_token: token, bbox: BBOX, proximity: PROXIMITY, country: "us", limit: "1",
  }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const feature = (await response.json()).features?.[0];
  const type: string | undefined = feature?.properties?.feature_type;
  const [lng, lat] = feature?.geometry?.coordinates ?? [];
  if (!type || !(EXACT.has(type) || NEAR.has(type)) || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const p = feature.properties;
  return {
    coords: { lat, lng },
    confidence: EXACT.has(type) ? "confirmed" : "approximate",
    label: [...new Set([p.name, p.full_address ?? p.place_formatted].filter(Boolean))].join(", "),
  };
}
