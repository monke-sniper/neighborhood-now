import type { LatLon } from '../types';

const EARTH_RADIUS_M = 6371000;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

export function haversineMeters(a: LatLon, b: LatLon): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bboxFromCenter(
  center: LatLon,
  radiusMeters: number,
): [number, number, number, number] {
  const dLat = radiusMeters / 111_320;
  const cosLat = Math.cos(toRadians(center.lat));
  const dLon = radiusMeters / (111_320 * Math.max(cosLat, 1e-6));
  return [
    center.lon - dLon,
    center.lat - dLat,
    center.lon + dLon,
    center.lat + dLat,
  ];
}

export function filterByRadius<T extends LatLon>(
  items: T[],
  center: LatLon,
  radiusMeters: number,
): T[] {
  return items.filter((item) => haversineMeters(item, center) <= radiusMeters);
}
