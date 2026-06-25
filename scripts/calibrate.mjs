// Calibration script. Run with: node scripts/calibrate.mjs
// Hits live Overpass + BuildData + local 311 file for 8 Toronto
// neighborhoods and writes p10/p50/p90 to src/lib/engine/benchmarks.ts.
// Captures at 3000m radius (the default). For other radii, score.ts
// scales by area ratio (radius/3000)^2.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const RADIUS = 3000;
const RECENT_PERMIT_MS = 1000 * 60 * 60 * 24 * 30 * 6;

const POINTS = [
  { name: 'King-Bay (downtown core)', lat: 43.6470, lon: -79.3870 },
  { name: 'Queen-Spadina (Queen West)', lat: 43.6470, lon: -79.4080 },
  { name: 'North York Centre', lat: 43.7615, lon: -79.4111 },
  { name: 'Scarborough Town Centre', lat: 43.7740, lon: -79.2570 },
  { name: 'Sherway Gardens (Etobicoke)', lat: 43.6205, lon: -79.5135 },
  { name: 'Yorkdale (North York)', lat: 43.7244, lon: -79.4519 },
  { name: 'Rexdale (Etobicoke)', lat: 43.7150, lon: -79.5760 },
  { name: 'The Beaches', lat: 43.6670, lon: -79.2970 },
];

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

function buildQuery(lat, lon) {
  return (
    `[out:json][timeout:25];` +
    `(` +
    `node["amenity"~"^(restaurant|cafe|fast_food|food_court|bar|pub|ice_cream|biergarten|pharmacy|bank|atm|post_office|school|kindergarten|college|university|library|hospital|clinic|doctors|dentist|police|fire_station|fuel|community_centre|social_facility|events_venue|townhall|courthouse|place_of_worship|recycling|arts_centre|museum|theatre|cinema|car_repair|car_wash|hairdresser|beauty|optician|florist|jewelry|laundry|dry_cleaning)$"]` +
    `(around:${RADIUS},${lat},${lon});` +
    `node["shop"~"^(supermarket|convenience|mall|pharmacy|bakery|butcher|greengrocer|hairdresser|beauty|optician|books|florist|jewelry|laundry)$"]` +
    `(around:${RADIUS},${lat},${lon});` +
    `node["leisure"~"^(park|garden|nature_reserve|playground|sports_centre|fitness_centre|swimming_pool|pitch|golf_course|dog_park)$"]` +
    `(around:${RADIUS},${lat},${lon});` +
    `node["highway"="bus_stop"](around:${RADIUS},${lat},${lon});` +
    `node["public_transport"~"^(station|stop_position|platform)$"]` +
    `(around:${RADIUS},${lat},${lon});` +
    `node["railway"~"^(station|subway_entrance|tram_stop|light_rail|halt)$"]` +
    `(around:${RADIUS},${lat},${lon});` +
    `way["leisure"~"^(park|garden|nature_reserve|playground|sports_centre|fitness_centre|swimming_pool|pitch|golf_course|dog_park)$"]` +
    `(around:${RADIUS},${lat},${lon});` +
    `way["landuse"~"^(forest|recreation_ground)$"]` +
    `(around:${RADIUS},${lat},${lon});` +
    `way["building"="construction"](around:${RADIUS},${lat},${lon});` +
    `way["landuse"="construction"](around:${RADIUS},${lat},${lon});` +
    `);` +
    `out tags center 5000;`
  );
}

function classify(tags) {
  const a = tags.amenity;
  const s = tags.shop;
  const l = tags.leisure;
  const lu = tags.landuse;
  const r = tags.railway;
  const h = tags.highway;
  const pt = tags.public_transport;
  if (a === 'restaurant' || a === 'fast_food' || a === 'food_court' || a === 'ice_cream' || a === 'biergarten' || a === 'bar' || a === 'pub') return 'restaurant';
  if (a === 'cafe') return 'cafe';
  if (a === 'school' || a === 'kindergarten' || a === 'college' || a === 'university' || a === 'library') return 'school';
  if (a === 'marketplace' || s === 'supermarket' || s === 'convenience' || s === 'bakery' || s === 'greengrocer' || s === 'butcher') return 'grocery';
  if (l === 'sports_centre' || l === 'fitness_centre' || l === 'swimming_pool' || l === 'pitch' || l === 'golf_course' || l === 'dog_park' || l === 'playground' || lu === 'recreation_ground') return 'recreation';
  if (l === 'park' || l === 'garden' || l === 'nature_reserve' || lu === 'park' || lu === 'forest') return 'park';
  if (h === 'bus_stop') return 'bus_stop';
  if (r === 'station' || r === 'subway_entrance' || r === 'tram_stop' || r === 'light_rail' || r === 'halt' || (pt && pt !== 'no')) return 'transit';
  if (lu === 'construction' || tags.building === 'construction') return 'construction';
  if (a === 'community_centre' || a === 'social_facility' || a === 'townhall' || a === 'courthouse' || a === 'place_of_worship' || a === 'recycling' || a === 'hospital' || a === 'clinic' || a === 'doctors' || a === 'dentist' || a === 'police' || a === 'fire_station' || a === 'post_office') return 'civic';
  if (a === 'arts_centre' || a === 'museum' || a === 'theatre' || a === 'cinema' || a === 'events_venue') return 'culture';
  if (a === 'car_repair' || a === 'car_wash' || a === 'hairdresser' || a === 'beauty' || a === 'optician' || a === 'florist' || a === 'jewelry' || a === 'laundry' || a === 'dry_cleaning' || a === 'pharmacy' || a === 'bank' || a === 'atm' || s === 'hairdresser' || s === 'beauty' || s === 'optician' || s === 'florist' || s === 'jewelry' || s === 'laundry') return 'service';
  return null;
}

async function fetchOverpass(lat, lon) {
  const query = buildQuery(lat, lon);
  const body = new URLSearchParams({ data: query }).toString();
  let lastErr = 'unknown';
  for (const url of OVERPASS_MIRRORS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 60_000);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'NeighborhoodNow-calibrate/1.0 (hackathon)',
        },
        body,
        cache: 'no-store',
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) { lastErr = `HTTP ${res.status} from ${url}`; continue; }
      const data = await res.json();
      return data.elements ?? [];
    } catch (e) {
      lastErr = `${url}: ${e?.message ?? e}`;
    }
  }
  throw new Error(`All mirrors failed. Last: ${lastErr}`);
}

async function fetchPermits() {
  const url = 'https://api.builddata.ca/permit/export?format=json&municipality=toronto';
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`BuildData HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.results) ? data.results : [];
}

function haversineMeters(aLat, aLon, bLat, bLon) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

async function samplePoint(point, allPermits, complaints) {
  let elements = [];
  try {
    elements = await fetchOverpass(point.lat, point.lon);
  } catch (e) {
    console.warn(`Overpass failed for ${point.name}: ${e.message}`);
  }
  const counts = {
    restaurant: 0, cafe: 0, school: 0, grocery: 0, park: 0,
    transit: 0, construction: 0, civic: 0, culture: 0,
    recreation: 0, service: 0,
  };
  for (const el of elements) {
    const k = classify(el.tags ?? {});
    if (k && counts[k] !== undefined) counts[k]++;
  }

  let permitsInRadius = 0;
  const now = Date.now();
  for (const p of allPermits) {
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
    const d = haversineMeters(point.lat, point.lon, p.lat, p.lng);
    if (d > RADIUS) continue;
    const t = Date.parse(p.issued_date ?? '');
    if (Number.isFinite(t) && now - t > RECENT_PERMIT_MS) continue;
    permitsInRadius++;
  }
  const permitsInRadiusCount = permitsInRadius;

  let complaintsInRadius = 0;
  for (const c of complaints) {
    if (typeof c.lat !== 'number' || typeof c.lon !== 'number') continue;
    const d = haversineMeters(point.lat, point.lon, c.lat, c.lon);
    if (d <= RADIUS) complaintsInRadius++;
  }

  console.log(
    `  ${point.name}: r=${counts.restaurant} c=${counts.cafe} s=${counts.school} g=${counts.grocery} p=${counts.park} t=${counts.transit} const=${counts.construction} civic=${counts.civic} cult=${counts.culture} rec=${counts.recreation} svc=${counts.service} permits=${permitsInRadiusCount} complaints=${complaintsInRadius}`,
  );

  return {
    ...counts,
    permits500m: permitsInRadiusCount,
    complaints: complaintsInRadius,
  };
}

function aggregate(samples) {
  const keys = [
    'restaurant', 'cafe', 'school', 'grocery', 'park',
    'transit', 'construction', 'civic', 'culture', 'recreation', 'service',
    'permits500m', 'complaints',
  ];
  const out = {};
  for (const k of keys) {
    const arr = samples.map((s) => s[k] ?? 0);
    out[k] = {
      p10: Math.round(percentile(arr, 0.1)),
      p50: Math.round(percentile(arr, 0.5)),
      p90: Math.round(percentile(arr, 0.9)),
      min: Math.min(...arr),
      max: Math.max(...arr),
      n: arr.length,
    };
  }
  return out;
}

function formatTs() {
  return new Date().toISOString();
}

function formatBenchmarksFile(agg, points, samples) {
  const header =
    '// AUTO-GENERATED by scripts/calibrate.mjs on ' + formatTs() + '.\n' +
    '// Source: live Overpass + BuildData + toronto-311.json for ' +
    points.length + ' Toronto points:\n' +
    points.map((p) => '//   - ' + p.name + ' (' + p.lat + ', ' + p.lon + ')').join('\n') + '\n' +
    '// Captured at 3000m radius. For other radii, score.ts scales by area ratio.\n' +
    '// Do not edit by hand. Re-run `node scripts/calibrate.mjs` to refresh.\n';

  return (
    header +
    `export const BENCHMARK_RADIUS_M = 3000;

export interface MetricBench {
  p10: number;
  p50: number;
  p90: number;
  min: number;
  max: number;
  n: number;
}

export type BenchKey =
  | 'restaurant'
  | 'cafe'
  | 'school'
  | 'grocery'
  | 'park'
  | 'transit'
  | 'construction'
  | 'permits500m'
  | 'complaints'
  | 'civic'
  | 'culture'
  | 'recreation'
  | 'service';

export interface Benchmarks {
  capturedAt: string;
  sampleSize: number;
  radiusMeters: number;
  points: Array<{ name: string; lat: number; lon: number }>;
  samples: Array<Record<string, number>>;
  metrics: Record<BenchKey, MetricBench>;
}

export function scaleBench(
  b: MetricBench,
  radiusMeters: number,
): { p10: number; p50: number; p90: number } {
  const r = (radiusMeters / BENCHMARK_RADIUS_M) ** 2;
  return { p10: b.p10 * r, p50: b.p50 * r, p90: b.p90 * r };
}

export const BENCHMARKS: Benchmarks = {
  capturedAt: ${JSON.stringify(formatTs())},
  sampleSize: ${points.length},
  radiusMeters: ${RADIUS},
  points: ${JSON.stringify(points, null, 2).replace(/\n/g, '\n  ')},
  samples: ${JSON.stringify(samples, null, 2).replace(/\n/g, '\n  ')},
  metrics: ${JSON.stringify(agg, null, 2).replace(/\n/g, '\n  ')},
};
`
  );
}

async function main() {
  console.log(`Calibrating at ${RADIUS}m radius...`);
  console.log('Loading BuildData Toronto permits...');
  const allPermits = await fetchPermits();
  console.log(`  ${allPermits.length} permits total`);

  console.log('Loading toronto-311.json...');
  const raw = readFileSync(path.join(root, 'public', 'data', 'toronto-311.json'), 'utf-8');
  const complaints = JSON.parse(raw);
  console.log(`  ${complaints.length} complaint records`);

  console.log(`Sampling ${POINTS.length} Toronto locations...`);
  const samples = [];
  for (let i = 0; i < POINTS.length; i++) {
    const p = POINTS[i];
    const s = await samplePoint(p, allPermits, complaints);
    samples.push(s);
    if (i < POINTS.length - 1) {
      console.log('  (waiting 5s before next sample)');
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  console.log('\nAggregating percentiles...');
  const agg = aggregate(samples);
  for (const [k, v] of Object.entries(agg)) {
    console.log(`  ${k.padEnd(12)} p10=${String(v.p10).padStart(5)} p50=${String(v.p50).padStart(5)} p90=${String(v.p90).padStart(5)}  (min=${v.min} max=${v.max})`);
  }

  const out = formatBenchmarksFile(agg, POINTS, samples);
  const outPath = path.join(root, 'src', 'lib', 'engine', 'benchmarks.ts');
  writeFileSync(outPath, out, 'utf-8');
  console.log(`\nWrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
