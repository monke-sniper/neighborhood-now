import { NextResponse } from 'next/server';
import { geocode } from '@/lib/api/nominatim';
import { fetchOverpassWithFallback } from '@/lib/api/overpass';
import { fetchPermits } from '@/lib/api/builddata';
import { fetchComplaints } from '@/lib/api/complaints';
import { fetchCensus } from '@/lib/api/census';
import { fetchAirQuality } from '@/lib/api/weather';
import { computeBreakdown, computeTotal, analyzeSchools } from '@/lib/engine/score';
import { detectAnomalies, type AnomalyContext } from '@/lib/engine/anomalies';
import { forecastTrend } from '@/lib/engine/forecast';
import { explainAll } from '@/lib/engine/explain';
import { lastNMonths, seriesFromDates, countWithinDays } from '@/lib/engine/timeseries';
import { log } from '@/lib/logger';
import { TTLCache } from '@/lib/utils/cache';
import { CONFIG, parseRadius } from '@/lib/config';
import { BENCHMARKS } from '@/lib/engine/benchmarks';
import { buildSyntheticReport } from '@/lib/synthetic';
import type { NeighborhoodReport } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const ROUTE_DEADLINE_MS = 9500;

const reportCache = new TTLCache<string, NeighborhoodReport>({ maxEntries: 200 });

function normalizeAddress(a: string): string {
  return a.trim().toLowerCase().replace(/\s+/g, ' ');
}

type TimedResult<T> =
  | { ok: true; value: T; ms: number }
  | { ok: false; error: string; ms: number };

async function timed<T>(fn: () => Promise<T>): Promise<TimedResult<T>> {
  const t0 =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    const value = await fn();
    const ms =
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    return { ok: true, value, ms };
  } catch (e) {
    const ms =
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      ms,
    };
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const address = url.searchParams.get('address')?.trim();
  const debug = url.searchParams.get('debug') === '1';
  const synth = url.searchParams.get('synth') === '1';
  const radius = parseRadius(url.searchParams.get('radius'));
  if (!address) {
    return NextResponse.json({ error: 'Missing ?address=' }, { status: 400 });
  }

  if (synth) {
    const report = buildSyntheticReport(address, radius, debug);
    if (!report) {
      return NextResponse.json(
        { error: `No synthetic data for "${address}"` },
        { status: 404 },
      );
    }
    return NextResponse.json(report);
  }

  const cacheKey = `${normalizeAddress(address)}|${radius}`;
  if (!debug) {
    const hit = reportCache.get(cacheKey);
    if (hit) {
      log.info('report.cache_hit', { address: cacheKey });
      return NextResponse.json(hit);
    }
  }

  try {
    const routeStart = Date.now();
    const geo = await geocode(address);
    const elapsedAfterGeocode = Date.now() - routeStart;
    const remainingBudget = Math.max(2000, ROUTE_DEADLINE_MS - elapsedAfterGeocode);

    const censusKey = req.headers.get('X-Census-Key') ?? '';
    const weatherKey = req.headers.get('X-Weather-Key') ?? '';

    type FetchesTuple = [
      TimedResult<Awaited<ReturnType<typeof fetchOverpassWithFallback>>>,
      TimedResult<Awaited<ReturnType<typeof fetchPermits>>>,
      TimedResult<Awaited<ReturnType<typeof fetchComplaints>>>,
      TimedResult<Awaited<ReturnType<typeof fetchCensus>>>,
      TimedResult<Awaited<ReturnType<typeof fetchAirQuality>>>,
    ];

    const makeFailureTuple = (): FetchesTuple => [
      { ok: false, error: `route deadline ${remainingBudget}ms`, ms: remainingBudget },
      { ok: false, error: `route deadline ${remainingBudget}ms`, ms: remainingBudget },
      { ok: false, error: `route deadline ${remainingBudget}ms`, ms: remainingBudget },
      { ok: false, error: `route deadline ${remainingBudget}ms`, ms: remainingBudget },
      { ok: false, error: `route deadline ${remainingBudget}ms`, ms: remainingBudget },
    ];

    const fetchesPromise: Promise<FetchesTuple> = Promise.all([
      timed(() => fetchOverpassWithFallback(geo, radius)),
      timed(() => fetchPermits(geo, radius)),
      timed(() => fetchComplaints(geo, radius)),
      timed(() => fetchCensus(geo, censusKey)),
      timed(() => fetchAirQuality(geo, weatherKey)),
    ]) as unknown as Promise<FetchesTuple>;

    const timeoutPromise: Promise<FetchesTuple> = new Promise((resolve) => {
      setTimeout(() => resolve(makeFailureTuple()), remainingBudget);
    });

    const [o, p, c, ce, w] = await Promise.race([
      fetchesPromise,
      timeoutPromise,
    ]);

    const oValue = o.ok
      ? o.value
      : {
          result: {
            amenities: [],
            buildings: [],
            transit: [],
            landuse: [],
            rawCount: 0,
          },
          fellBack: true,
          totalMs: o.ms,
        };
    const amenities = oValue.result;
    const amenitiesOk = o.ok && !oValue.fellBack && amenities.amenities.length > 0;
    const permits = p.ok ? p.value : [];
    const complaints = c.ok ? c.value : [];
    const census = ce.ok ? ce.value : null;
    const airQuality = w.ok ? w.value : null;

    const errorMap: Record<string, string | null> = {
      overpass: o.ok ? null : o.error,
      builddata: p.ok ? null : p.error,
      complaints: c.ok ? null : c.error,
      census: ce.ok ? null : ce.error,
      weather: w.ok ? null : w.error,
    };

    log.info('report.fetched', {
      address: cacheKey,
      ms: {
        overpass: Number(o.ms.toFixed(1)),
        builddata: Number(p.ms.toFixed(1)),
        complaints: Number(c.ms.toFixed(1)),
        census: Number(ce.ms.toFixed(1)),
        weather: Number(w.ms.toFixed(1)),
      },
      counts: {
        amenities: amenities.amenities.length,
        permits: permits.length,
        complaints: complaints.length,
        overpassRaw: amenities.rawCount,
      },
      fellBack: oValue.fellBack,
    });

    const nowMs = Date.now();
    const computed = computeBreakdown(amenities.amenities, permits, radius, { nowMs });
    const breakdown = computed.breakdown;
    const score = computeTotal(breakdown, { presence: computed.presence });
    const explanations = explainAll(score, amenities.amenities, permits, radius, { nowMs });
    const schoolAnalysis = analyzeSchools(
      amenities.amenities,
      permits,
      radius,
      { lat: geo.lat, lon: geo.lon },
      { nowMs },
    );

    const months = lastNMonths(12).map((m) => m.key);
    const permitsByMonth = seriesFromDates(
      permits.map((p) => p.issuedDate),
      months,
    );
    const complaintsByMonth = seriesFromDates(
      complaints.map((c) => c.date),
      months,
    );

    const permitsTrend = forecastTrend(permitsByMonth, 'Building permits');
    const complaintsTrend = forecastTrend(complaintsByMonth, '311 complaints');
    const trends = [permitsTrend, complaintsTrend];

    const permitsLast30d = countWithinDays(
      permits.map((p) => p.issuedDate),
      30,
      nowMs,
    );
    const permitsLast6m = countWithinDays(
      permits.map((p) => p.issuedDate),
      30 * 6,
      nowMs,
    );
    const complaintsLast30d = countWithinDays(
      complaints.map((c) => c.date),
      30,
      nowMs,
    );
    const complaintsLast90d = countWithinDays(
      complaints.map((c) => c.date),
      90,
      nowMs,
    );

    const amenityCounts = {
      restaurant: computed.counts.restaurants,
      cafe: computed.counts.cafes,
      school: computed.counts.schools,
      grocery: computed.counts.groceries,
      park: computed.counts.parks,
      transit: computed.counts.transit,
      construction: computed.counts.construction,
    };

    const anomalyCtx: AnomalyContext = {
      permitsLast30d,
      permitsLast6m,
      complaintsLast30d,
      complaintsLast90d,
      amenityCounts,
      scoreBreakdown: breakdown,
      airQuality: airQuality ? { pm25: airQuality.pm25 } : null,
      census: census ? { medianIncome: census.medianIncome } : null,
      radiusMeters: radius,
    };

    const anomalies = detectAnomalies(anomalyCtx);

    const report: NeighborhoodReport = {
      address: geo.displayName,
      coords: { lat: geo.lat, lon: geo.lon },
      fetchedAt: new Date().toISOString(),
      radiusMeters: radius,
      score,
      explanations,
      amenities,
      permits,
      complaints,
      anomalies,
      trends,
      sources: {
        overpass: amenitiesOk ? 'ok' : o.ok ? 'partial' : 'failed',
        builddata: p.ok ? 'ok' : 'failed',
        complaints: c.ok ? 'ok' : 'failed',
        census: ce.ok ? 'ok' : 'failed',
        weather: w.ok ? 'ok' : 'failed',
      },
      errors: errorMap,
      benchmarksCapturedAt: BENCHMARKS.capturedAt,
      schoolImpacts: schoolAnalysis.impacts,
    };

    if (debug) {
      const counts = {
        restaurants: amenities.amenities.filter((a) => a.kind === 'restaurant').length,
        cafes: amenities.amenities.filter((a) => a.kind === 'cafe').length,
        schools: amenities.amenities.filter((a) => a.kind === 'school').length,
        groceries: amenities.amenities.filter((a) => a.kind === 'grocery').length,
        parks: amenities.amenities.filter((a) => a.kind === 'park').length,
        transitOnSite: amenities.transit.length,
        transitInAmenities: amenities.amenities.filter(
          (a) => a.kind === 'bus_stop' || a.kind === 'transit',
        ).length,
        construction: amenities.amenities.filter(
          (a) => a.kind === 'construction',
        ).length,
        buildings: amenities.buildings.length,
        landuse: amenities.landuse.length,
        rawElements: amenities.rawCount,
      };
      const areaKm2 =
        (radius / 1000) ** 2 * Math.PI;
      const debugInfo = {
        geocode: {
          displayName: geo.displayName,
          lat: geo.lat,
          lon: geo.lon,
          bbox: geo.bbox,
        },
        fetches: {
          overpass: {
            ok: o.ok,
            ms: Number(o.ms.toFixed(1)),
            error: o.ok ? null : o.error,
            rawElements: amenities.rawCount,
            parsed: counts,
          },
          builddata: {
            ok: p.ok,
            ms: Number(p.ms.toFixed(1)),
            error: p.ok ? null : p.error,
            count: permits.length,
          },
          complaints: {
            ok: c.ok,
            ms: Number(c.ms.toFixed(1)),
            error: c.ok ? null : c.error,
            count: complaints.length,
          },
          census: {
            ok: ce.ok,
            ms: Number(ce.ms.toFixed(1)),
            error: ce.ok ? null : ce.error,
            present: census !== null,
            medianIncome: census?.medianIncome ?? null,
          },
          weather: {
            ok: w.ok,
            ms: Number(w.ms.toFixed(1)),
            error: w.ok ? null : w.error,
            present: airQuality !== null,
            pm25: airQuality?.pm25 ?? null,
          },
        },
        score: {
          breakdown: score.breakdown,
          total: score.total,
          cityAverage: score.cityAverage,
          weights: CONFIG.weights,
          areaKm2: Number(areaKm2.toFixed(2)),
        },
      };
      return NextResponse.json({ ...report, debug: debugInfo });
    }

    reportCache.set(cacheKey, report, CONFIG.cache.reportTtlMs);
    return NextResponse.json(report);
  } catch (err) {
    log.error('report.failed', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Internal report error' }, { status: 500 });
  }
}
