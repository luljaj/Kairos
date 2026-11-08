import type { LatLng } from "@/lib/contracts";

export type LngLat = [number, number];
export const coordinates = ({ lng, lat }: LatLng): LngLat => [lng, lat];

export function distance(a: LngLat, b: LngLat) {
  const rad = Math.PI / 180;
  const h = Math.sin((b[1] - a[1]) * rad / 2) ** 2
    + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin((b[0] - a[0]) * rad / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(Math.min(1, h)));
}

/** Distance-weighted route interpolation, recovered from the original dashboard sim. */
export function measure(coords: LngLat[]) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + distance(coords[i - 1], coords[i]));
  return { coords, cum, total: cum[cum.length - 1] };
}

export function pointAt(m: ReturnType<typeof measure>, fraction: number) {
  if (m.coords.length < 2) throw new Error("A route requires two coordinates");
  const d = Math.min(Math.max(fraction, 0), 1) * m.total;
  let index = 1;
  while (index < m.cum.length - 1 && m.cum[index] < d) index++;
  const a = m.coords[index - 1], b = m.coords[index];
  const t = (d - m.cum[index - 1]) / (m.cum[index] - m.cum[index - 1] || 1);
  const rad = Math.PI / 180;
  const y = Math.sin((b[0] - a[0]) * rad) * Math.cos(b[1] * rad);
  const x = Math.cos(a[1] * rad) * Math.sin(b[1] * rad)
    - Math.sin(a[1] * rad) * Math.cos(b[1] * rad) * Math.cos((b[0] - a[0]) * rad);
  return {
    pos: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as LngLat,
    heading: Math.atan2(y, x) / rad,
    index,
  };
}
