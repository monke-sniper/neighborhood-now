// Calibration script. Run with: node scripts/calibrate.mjs
// Hits live Overpass + BuildData + local 311 file for 5 Toronto
// neighborhoods and writes p10/p50/p90 to src/lib/engine/benchmarks.ts.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const RADIUS = 1500;
const RECENT_PERMIT_MS = 1000 * 60 * 60 * 24 * 30 * 6;

const POINTS = [
  { name: 'King-Bay (downtown core)', lat: 43.6470, lon: -79.3870 },
  { name: 'Queen-Spadina (Queen West)', lat: 43.6470, lon: -79.4080 },
  { name: 'North York Centre', lat: 43.7615, lon: -79.4111 },
  { name: 'Scarborough Town Centre', lat: 43.7740, lon: -79.2570 },
  { name: 'Sherway Gardens (Etobicoke)', lat: 43.6205, lon: -79.5135 },
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
    `node["amenity"~"^(restaurant|cafe|fast_food|food_court|bar|pub|ice_cream|biergarten|pharmacy|bank|atm|post_office|school|kindergarten|college|university|library|hospital|clinic|doctors|dentist|police|fire_station|fuel)$"]` +
    `(around:${RADIUS},${lat},${lon});` +
    `node["shop"~"^(supermarket|convenience|mall|pharmacy|bakery|butcher|greengrocer|hairdresser|beauty|optician|books)$"]` +
    `(around:${RADIUS},${lat},${lon});` +
    `node["leisure"~"^(park|garden|nature_reserve|playground|sports_centre|fitness_centre|swimming_pool|pitch)$"]` +
    `(around:${RADIUS},${lat},${lon});` +
    `node["highway"="bus_stop"](around:${RADIUS},${lat},${lon});` +
    `node["public_transport"~"^(station|stop_position|platform)$"]` +
    `(around:${RADIUS},${lat},${lon});` +
    `node["railway"~"^(station|subway_entrance|tram_stop|light_rail|halt)$"]` +
    `(around:${RADIUS},${lat},${lon});` +
    `way["leisure"~"^(park|garden|nature_reserve)$"]` +
    `(around:${RADIUS},${lat},${lon});` +
    `way["landuse"~"^(park|forest|recreation_ground|meadow|grass|cemetery)$"]` +
    `(around:${RADIUS},${lat},${lon});` +
    `way["building"="construction"](around:${RADIUS},${lat},${lon});` +
    `way["landuse"="construction"](around:${RADIUS},${lat},${lon});` +
    `);` +
    `out tags center 2000;`
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
  if (l === 'park' || l === 'garden' || l === 'nature_reserve' || l === 'playground' || lu === 'park' || lu === 'forest' || lu === 'recreation_ground' || lu === 'meadow' || lu === 'grass' || lu === 'cemetery') return 'park';
  if (h === 'bus_stop') return 'bus_stop';
  if (r === 'station' || r === 'subway_entrance' || r === 'tram_stop' || r === 'light_rail' || r === 'halt' || (pt && pt !== 'no')) return 'transit';
  if (lu === 'construction' || tags.building === 'construction') return 'construction';
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
  const counts = { restaurant: 0, cafe: 0, school: 0, grocery: 0, park: 0, transit: 0, construction: 0 };
  for (const el of elements) {
    const k = classify(el.tags ?? {});
    if (k && counts[k] !== undefined) counts[k]++;
  }
  const transitTotal = counts.transit + (elements.filter((e) => (e.tags?.highway === 'bus_stop') && classify(e.tags ?? {}) === null).length);
  counts.transit = transitTotal;

  let permitsInRadius = 0;
  const now = Date.now();
  for (const p of allPermits) {
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
    const d = haversineMeters(point.lat, point.lon, p.lat, p.lng);
    if (d > 1500) continue;
    const t = Date.parse(p.issued_date ?? '');
    if (Number.isFinite(t) && now - t > RECENT_PERMIT_MS) continue;
    permitsInRadius++;
  }
  const permitsIn500m = permitsInRadius;

  let complaintsInRadius = 0;
  for (const c of complaints) {
    if (typeof c.lat !== 'number' || typeof c.lon !== 'number') continue;
    const d = haversineMeters(point.lat, point.lon, c.lat, c.lon);
    if (d <= RADIUS) complaintsInRadius++;
  }

  console.log(`  ${point.name}: restaurants=${counts.restaurant} cafes=${counts.cafe} schools=${counts.school} groceries=${counts.grocery} parks=${counts.park} transit=${counts.transit} construction=${counts.construction} permits=${permitsIn500m} complaints=${complaintsInRadius}`);

  return { ...counts, permits500m: permitsIn500m, complaints: complaintsInRadius };
}

function aggregate(samples) {
  const keys = ['restaurant', 'cafe', 'school', 'grocery', 'park', 'transit', 'construction', 'permits500m', 'complaints'];
  const out = {};
  for (const k of keys) {
    const arr = samples.map((s) => s[k]);
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
    '// Do not edit by hand. Re-run `node scripts/calibrate.mjs` to refresh.\n';

  return header + `export interface MetricBench {
  p10: number;
  p50: number;
  p90: number;
  min: number;
  max: number;
  n: number;
}

export interface Benchmarks {
  capturedAt: string;
  sampleSize: number;
  points: Array<{ name: string; lat: number; lon: number }>;
  samples: Array<Record<string, number>>;
  metrics: Record<
    | 'restaurant'
    | 'cafe'
    | 'school'
    | 'grocery'
    | 'park'
    | 'transit'
    | 'construction'
    | 'permits500m'
    | 'complaints',
    MetricBench
  >;
}

export const BENCHMARKS: Benchmarks = {
  capturedAt: ${JSON.stringify(formatTs())},
  sampleSize: ${points.length},
  points: ${JSON.stringify(points, null, 2).replace(/\n/g, '\n  ')},
  samples: ${JSON.stringify(samples, null, 2).replace(/\n/g, '\n  ')},
  metrics: ${JSON.stringify(agg, null, 2).replace(/\n/g, '\n  ')},
};
`;
}

async function main() {
  console.log('Loading BuildData Toronto permits...');
  const allPermits = await fetchPermits();
  console.log(`  ${allPermits.length} permits total`);

  console.log('Loading toronto-311.json...');
  const raw = readFileSync(path.join(root, 'data', 'toronto-311.json'), 'utf-8');
  const complaints = JSON.parse(raw);
  console.log(`  ${complaints.length} complaint records`);

  console.log(`Sampling ${POINTS.length} Toronto locations...`);
  const samples = [];
  for (let i = 0; i < POINTS.length; i++) {
    const p = POINTS[i];
    const s = await samplePoint(p, allPermits, complaints);
    samples.push(s);
    if (i < POINTS.length - 1) {
      console.log('  (waiting 3s before next sample)');
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  console.log('\nAggregating percentiles...');
  const agg = aggregate(samples);
  for (const [k, v] of Object.entries(agg)) {
    console.log(`  ${k}: p10=${v.p10} p50=${v.p50} p90=${v.p90} (min=${v.min} max=${v.max})`);
  }

  const out = formatBenchmarksFile(agg, POINTS, samples);
  const outPath = path.join(root, 'src', 'lib', 'engine', 'benchmarks.ts');
  writeFileSync(outPath, out, 'utf-8');
  console.log(`\nWrote ${outPath}`);
}

main().catch((e) => {
  console.error('Calibration failed:', e);
  process.exit(1);
});
