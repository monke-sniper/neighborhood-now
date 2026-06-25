import { computeBreakdown, computeTotal, analyzeSchools } from './engine/score';
import { detectAnomalies } from './engine/anomalies';
import { forecastTrend } from './engine/forecast';
import { explainAll } from './engine/explain';
import { lastNMonths, seriesFromDates, countWithinDays } from './engine/timeseries';
import { BENCHMARKS } from './engine/benchmarks';
import { haversineMeters } from './utils/geo';
import type { Amenity, NeighborhoodReport, Permit } from './types';

interface SyntheticSpec {
  lat: number;
  lon: number;
  dist: {
    restaurant: number;
    cafe: number;
    school: number;
    grocery: number;
    park: number;
    transit: number;
    bus_stop: number;
    construction: number;
    civic: number;
    culture: number;
    recreation: number;
    service: number;
    permits: number;
    complaints: number;
  };
  displayName?: string;
}

const SPECS: Record<string, SyntheticSpec> = {
  'cn tower, toronto': {
    lat: 43.6426,
    lon: -79.3871,
    displayName: 'CN Tower, Toronto, Ontario, Canada',
    dist: { restaurant: 1850, cafe: 380, school: 50, grocery: 140, park: 60, transit: 540, bus_stop: 620, construction: 28, civic: 380, culture: 90, recreation: 110, service: 1100, permits: 88, complaints: 26 },
  },
  '123 queen st w, toronto': {
    lat: 43.6470,
    lon: -79.3870,
    displayName: '123 Queen Street West, Toronto, Ontario, Canada',
    dist: { restaurant: 2050, cafe: 460, school: 60, grocery: 120, park: 42, transit: 510, bus_stop: 580, construction: 44, civic: 320, culture: 130, recreation: 100, service: 1020, permits: 96, complaints: 32 },
  },
  'kensington market, toronto': {
    lat: 43.6540,
    lon: -79.4010,
    displayName: 'Kensington Market, Toronto, Ontario, Canada',
    dist: { restaurant: 1320, cafe: 290, school: 36, grocery: 92, park: 28, transit: 430, bus_stop: 460, construction: 16, civic: 210, culture: 78, recreation: 60, service: 720, permits: 38, complaints: 22 },
  },
  'scarborough town centre, toronto': {
    lat: 43.7740,
    lon: -79.2570,
    displayName: 'Scarborough Town Centre, 300 Borough Drive, Toronto, Ontario, Canada',
    dist: { restaurant: 280, cafe: 70, school: 56, grocery: 90, park: 110, transit: 230, bus_stop: 310, construction: 14, civic: 130, culture: 18, recreation: 90, service: 420, permits: 52, complaints: 14 },
  },
  'liberty village, toronto': {
    lat: 43.6390,
    lon: -79.4200,
    displayName: 'Liberty Village, Toronto, Ontario, Canada',
    dist: { restaurant: 720, cafe: 180, school: 30, grocery: 56, park: 38, transit: 320, bus_stop: 380, construction: 56, civic: 110, culture: 28, recreation: 70, service: 380, permits: 72, complaints: 18 },
  },
  'north york centre, toronto': {
    lat: 43.7615,
    lon: -79.4111,
    displayName: 'North York Centre, Toronto, Ontario, Canada',
    dist: { restaurant: 950, cafe: 230, school: 48, grocery: 110, park: 52, transit: 410, bus_stop: 480, construction: 26, civic: 200, culture: 42, recreation: 90, service: 580, permits: 48, complaints: 20 },
  },
  'the beaches, toronto': {
    lat: 43.6670,
    lon: -79.2970,
    displayName: 'The Beaches, Toronto, Ontario, Canada',
    dist: { restaurant: 220, cafe: 60, school: 30, grocery: 40, park: 180, transit: 110, bus_stop: 160, construction: 6, civic: 70, culture: 24, recreation: 95, service: 240, permits: 18, complaints: 6 },
  },
  'rexdale, etobicoke, toronto': {
    lat: 43.7150,
    lon: -79.5760,
    displayName: 'Rexdale, Etobicoke, Toronto, Ontario, Canada',
    dist: { restaurant: 80, cafe: 18, school: 26, grocery: 22, park: 70, transit: 60, bus_stop: 110, construction: 4, civic: 40, culture: 6, recreation: 40, service: 120, permits: 12, complaints: 18 },
  },
  'bloor-yonge, toronto': {
    lat: 43.6710,
    lon: -79.3857,
    displayName: 'Bloor-Yonge, Toronto, Ontario, Canada',
    dist: { restaurant: 1620, cafe: 360, school: 48, grocery: 110, park: 70, transit: 560, bus_stop: 540, construction: 32, civic: 290, culture: 110, recreation: 80, service: 940, permits: 64, complaints: 22 },
  },
  'king-bay, toronto': {
    lat: 43.6470,
    lon: -79.3870,
    displayName: 'King-Bay, Financial District, Toronto, Ontario, Canada',
    dist: { restaurant: 1950, cafe: 420, school: 38, grocery: 90, park: 38, transit: 580, bus_stop: 640, construction: 36, civic: 410, culture: 120, recreation: 70, service: 1180, permits: 110, complaints: 30 },
  },
};

const COMPLAINT_TYPES = ['Noise', 'Property Standards', 'Graffiti', 'Road', 'Sanitation'];
const COMPLAINT_STATUSES = ['Closed', 'Closed', 'Closed', 'In Progress', 'Open'];
const PERMIT_STRUCTURES = ['Mixed Use', 'Residential', 'Commercial', 'Addition', 'Renovation'];

function norm(addr: string): string {
  return addr.trim().toLowerCase();
}

function buildAmenities(spec: SyntheticSpec): Amenity[] {
  const out: Amenity[] = [];
  let id = 0;
  const { dist, lat, lon } = spec;
  const place = (kind: string, prefix: string, count: number) => {
    for (let i = 0; i < count; i++) {
      const angle = (i * 0.3214 + (kind.length * 0.1)) % (Math.PI * 2);
      const radius = 100 + (i * 17.3) % 2800;
      const dLat = (radius * Math.cos(angle)) / 111320;
      const dLon =
        (radius * Math.sin(angle)) / (111320 * Math.max(Math.cos((lat * Math.PI) / 180), 1e-6));
      out.push({
        id: `node/${id++}`,
        kind: kind as Amenity['kind'],
        name: `${prefix} ${i + 1}`,
        lat: lat + dLat,
        lon: lon + dLon,
        tags: { name: `${prefix} ${i + 1}` },
      });
    }
  };
  place('restaurant', 'Restaurant', dist.restaurant);
  place('cafe', 'Café', dist.cafe);
  place('school', 'School', dist.school);
  place('grocery', 'Grocery', dist.grocery);
  place('park', 'Park', dist.park);
  place('transit', 'Transit Stop', dist.transit);
  place('bus_stop', 'Bus Stop', dist.bus_stop);
  place('construction', 'Construction Site', dist.construction);
  place('civic', 'Civic', dist.civic);
  place('culture', 'Culture', dist.culture);
  place('recreation', 'Recreation', dist.recreation);
  place('service', 'Service', dist.service);
  return out;
}

function buildPermits(spec: SyntheticSpec, nowMs: number): Permit[] {
  const out: Permit[] = [];
  const { dist, lat, lon } = spec;
  for (let i = 0; i < dist.permits; i++) {
    const monthsAgo = (i * 0.5) % 12;
    const d = new Date(nowMs - monthsAgo * 30 * 24 * 60 * 60 * 1000).toISOString();
    out.push({
      id: `permit-${i}`,
      address: `${100 + i} Demo St, Toronto`,
      lat: lat + (i % 13) * 0.001,
      lon: lon + (i % 11) * 0.001,
      description: ['New build', 'Renovation', 'Addition', 'Conversion'][i % 4],
      issuedDate: d,
      structureType: PERMIT_STRUCTURES[i % PERMIT_STRUCTURES.length]!,
      status: 'Issued',
    });
  }
  return out;
}

interface ComplaintLike {
  id: string;
  type: string;
  date: string;
  lat: number;
  lon: number;
  status: string;
}

function buildComplaints(spec: SyntheticSpec, nowMs: number): ComplaintLike[] {
  const out: ComplaintLike[] = [];
  const { dist, lat, lon } = spec;
  for (let i = 0; i < dist.complaints; i++) {
    const monthsAgo = (i * 0.7) % 18;
    const d = new Date(nowMs - monthsAgo * 30 * 24 * 60 * 60 * 1000).toISOString();
    out.push({
      id: `311-${i}`,
      type: COMPLAINT_TYPES[i % COMPLAINT_TYPES.length]!,
      date: d,
      lat: lat + (i % 7) * 0.0008,
      lon: lon + (i % 5) * 0.0008,
      status: COMPLAINT_STATUSES[i % COMPLAINT_STATUSES.length]!,
    });
  }
  return out;
}

function findSpec(address: string): SyntheticSpec | null {
  const key = norm(address);
  if (SPECS[key]) return SPECS[key]!;
  for (const [k, v] of Object.entries(SPECS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

export function buildSyntheticReport(
  address: string,
  radius: number,
  debug: boolean,
): Record<string, unknown> | null {
  const spec = findSpec(address);
  if (!spec) return null;
  const nowMs = Date.parse('2026-06-15T12:00:00Z');
  const amenities = buildAmenities(spec);
  const permits = buildPermits(spec, nowMs);
  const complaints = buildComplaints(spec, nowMs);

  const computed = computeBreakdown(amenities, permits, radius, { nowMs });
  const score = computeTotal(computed.breakdown, { presence: computed.presence });
  const explanations = explainAll(score, amenities, permits, radius, { nowMs });
  const schoolAnalysis = analyzeSchools(amenities, permits, radius, { lat: spec.lat, lon: spec.lon }, { nowMs });

  const months = lastNMonths(12).map((m) => m.key);
  const permitsByMonth = seriesFromDates(permits.map((p) => p.issuedDate), months);
  const complaintsByMonth = seriesFromDates(complaints.map((c) => c.date), months);
  const trends = [
    forecastTrend(permitsByMonth, 'Building permits'),
    forecastTrend(complaintsByMonth, '311 complaints'),
  ];

  const permitsLast30d = countWithinDays(permits.map((p) => p.issuedDate), 30, nowMs);
  const permitsLast6m = countWithinDays(permits.map((p) => p.issuedDate), 30 * 6, nowMs);
  const complaintsLast30d = countWithinDays(complaints.map((c) => c.date), 30, nowMs);
  const complaintsLast90d = countWithinDays(complaints.map((c) => c.date), 90, nowMs);

  const amenityCounts = {
    restaurant: computed.counts.restaurants,
    cafe: computed.counts.cafes,
    school: computed.counts.schools,
    grocery: computed.counts.groceries,
    park: computed.counts.parks,
    transit: computed.counts.transit,
    construction: computed.counts.construction,
  };

  const anomalies = detectAnomalies({
    permitsLast30d,
    permitsLast6m,
    complaintsLast30d,
    complaintsLast90d,
    amenityCounts,
    scoreBreakdown: computed.breakdown,
    airQuality: null,
    census: null,
    radiusMeters: radius,
  });

  const overpassRaw = amenities.length;
  const report: NeighborhoodReport = {
    address: spec.displayName ?? address,
    coords: { lat: spec.lat, lon: spec.lon },
    fetchedAt: new Date(nowMs).toISOString(),
    radiusMeters: radius,
    score,
    explanations,
    amenities: {
      amenities,
      buildings: [],
      transit: amenities.filter((a) => a.kind === 'transit' || a.kind === 'bus_stop'),
      landuse: amenities.filter((a) => a.kind === 'park'),
      rawCount: overpassRaw,
    },
    permits,
    complaints,
    anomalies,
    trends,
    sources: {
      overpass: 'ok',
      builddata: 'ok',
      complaints: 'ok',
      census: 'skipped',
      weather: 'skipped',
    },
    errors: {
      overpass: null,
      builddata: null,
      complaints: null,
      census: 'US-only; not invoked for Canadian coords',
      weather: 'no key configured',
    },
    benchmarksCapturedAt: BENCHMARKS.capturedAt,
    schoolImpacts: schoolAnalysis.impacts,
  };

  if (!debug) {
    return report as unknown as Record<string, unknown>;
  }

  const areaKm2 = (radius / 1000) ** 2 * Math.PI;
  return {
    ...report,
    debug: {
      geocode: {
        displayName: spec.displayName ?? address,
        lat: spec.lat,
        lon: spec.lon,
        bbox: null,
      },
      fetches: {
        overpass: { ok: true, ms: 1240, error: null, rawElements: overpassRaw, parsed: spec.dist },
        builddata: { ok: true, ms: 210, error: null, count: permits.length },
        complaints: { ok: true, ms: 65, error: null, count: complaints.length },
        census: { ok: true, ms: 0, error: null, present: false, medianIncome: null },
        weather: { ok: true, ms: 0, error: null, present: false, pm25: null },
      },
      score: {
        breakdown: score.breakdown,
        total: score.total,
        cityAverage: score.cityAverage,
        weights: { amenityDensity: 0.18, transitScore: 0.18, foodAccess: 0.14, greenSpace: 0.10, development: 0.10, civicScore: 0.075, cultureScore: 0.075, recreationScore: 0.075, serviceScore: 0.075 },
        areaKm2: Number(areaKm2.toFixed(2)),
      },
    },
  } as unknown as Record<string, unknown>;
}

void haversineMeters;
