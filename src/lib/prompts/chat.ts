import type {
  Amenity,
  AmenityKind,
  LatLon,
  NeighborhoodReport,
} from '../types';
import { haversineMeters } from '../utils/geo';
import { hasRealName, pickName } from '../utils/amenity';

const NAMED_PER_KIND: Partial<Record<AmenityKind, number>> = {
  restaurant: 10,
  school: 5,
  grocery: 5,
  park: 5,
  cafe: 5,
  civic: 5,
  culture: 5,
  recreation: 5,
  service: 5,
  construction: 3,
};

export function pickDisplayName(a: Amenity): string | null {
  if (hasRealName(a)) return pickName(a);
  return null;
}

export function namedByKind(
  amenities: Amenity[],
  center: LatLon,
): Record<string, Array<{ name: string; kind: AmenityKind; distanceKm: number }>> {
  const grouped = new Map<AmenityKind, Amenity[]>();
  for (const a of amenities) {
    const name = pickDisplayName(a);
    if (!name) continue;
    const arr = grouped.get(a.kind) ?? [];
    arr.push(a);
    grouped.set(a.kind, arr);
  }
  const out: Record<string, Array<{ name: string; kind: AmenityKind; distanceKm: number }>> = {};
  for (const [kind, items] of grouped) {
    const limit = NAMED_PER_KIND[kind] ?? 5;
    items.sort(
      (a, b) => haversineMeters(a, center) - haversineMeters(b, center),
    );
    out[kind] = items.slice(0, limit).map((a) => ({
      name: pickDisplayName(a)!,
      kind,
      distanceKm: Number((haversineMeters(a, center) / 1000).toFixed(2)),
    }));
  }
  return out;
}

export function buildChatContext(report: NeighborhoodReport): string {
  const safe = JSON.stringify(
    {
      address: report.address,
      score: report.score,
      amenities: {
        count: report.amenities.amenities.length,
        transit: report.amenities.transit.length,
        buildings: report.amenities.buildings.length,
        named: namedByKind(report.amenities.amenities, report.coords),
      },
      permits: report.permits.length,
      recentPermits: report.permits.slice(0, 5).map((p) => ({
        address: p.address,
        description: p.description,
        issuedDate: p.issuedDate,
      })),
      complaints: report.complaints.length,
      recentComplaints: report.complaints.slice(0, 5).map((c) => ({
        type: c.type,
        date: c.date,
        status: c.status,
      })),
      anomalies: report.anomalies,
      trends: report.trends,
    },
    null,
    2,
  );
  return (
    "You are a neighborhood intelligence assistant. Answer the user's question " +
    'using ONLY the data provided below. If the data does not contain enough ' +
    'information to answer, say so. Never invent numbers or claims. Keep ' +
    'answers under 120 words.\n\nNEIGHBORHOOD DATA:\n' +
    safe
  );
}
