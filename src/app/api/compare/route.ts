import { NextResponse } from 'next/server';
import { geocode } from '@/lib/api/nominatim';
import { fetchOverpassWithFallback } from '@/lib/api/overpass';
import { fetchPermits } from '@/lib/api/builddata';
import { fetchComplaints } from '@/lib/api/complaints';
import { fetchCensus } from '@/lib/api/census';
import { fetchAirQuality } from '@/lib/api/weather';
import {
  computeBreakdown,
  computeTotal,
  analyzeSchools,
} from '@/lib/engine/score';
import { detectAnomalies } from '@/lib/engine/anomalies';
import { forecastTrend } from '@/lib/engine/forecast';
import { explainAll } from '@/lib/engine/explain';
import {
  lastNMonths,
  seriesFromDates,
  countWithinDays,
} from '@/lib/engine/timeseries';
import { log } from '@/lib/logger';
import { TTLCache } from '@/lib/utils/cache';
import { CONFIG, parseRadius } from '@/lib/config';
import { BENCHMARKS } from '@/lib/engine/benchmarks';
import { buildSyntheticReport } from '@/lib/synthetic';
import type { NeighborhoodReport, ScoreBreakdown } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const compareCache = new TTLCache<string, ComparisonResponse>({ maxEntries: 200 });

interface ComparisonResponse {
  a: NeighborhoodReport;
  b: NeighborhoodReport;
  delta: {
    total: number;
    breakdownDelta: Record<keyof ScoreBreakdown, number>;
    aBetter: string[];
    bBetter: string[];
    anomaliesA: number;
    anomaliesB: number;
    aPermits: number;
    bPermits: number;
    aComplaints: number;
    bComplaints: number;
    aRadiusMeters: number;
    bRadiusMeters: number;
  };
  fetchedAt: string;
  radius: number;
}

async function buildReport(
  address: string,
  radius: number,
  headers: Headers,
): Promise<NeighborhoodReport> {
  const geo = await geocode(address);
  const nowMs = Date.now();
  const censusKey = headers.get('X-Census-Key') ?? '';
  const weatherKey = headers.get('X-Weather-Key') ?? '';

  const fetches = await Promise.allSettled([
    fetchOverpassWithFallback(geo, radius),
    fetchPermits(geo, radius),
    fetchComplaints(geo, radius),
    fetchCensus(geo, censusKey),
    fetchAirQuality(geo, weatherKey),
  ]);

  const o = fetches[0];
  const p = fetches[1];
  const c = fetches[2];
  const ce = fetches[3];
  const w = fetches[4];

  const amenities = o.status === 'fulfilled'
    ? o.value.result
    : { amenities: [], buildings: [], transit: [], landuse: [], rawCount: 0 };
  const permits = p.status === 'fulfilled' ? p.value : [];
  const complaints = c.status === 'fulfilled' ? c.value : [];
  const census = ce.status === 'fulfilled' ? ce.value : null;
  const airQuality = w.status === 'fulfilled' ? w.value : null;

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
    permits.map((pp) => pp.issuedDate),
    months,
  );
  const complaintsByMonth = seriesFromDates(
    complaints.map((cc) => cc.date),
    months,
  );
  const trends = [
    forecastTrend(permitsByMonth, 'Building permits'),
    forecastTrend(complaintsByMonth, '311 complaints'),
  ];

  const permitsLast30d = countWithinDays(permits.map((pp) => pp.issuedDate), 30, nowMs);
  const permitsLast6m = countWithinDays(permits.map((pp) => pp.issuedDate), 30 * 6, nowMs);
  const complaintsLast30d = countWithinDays(complaints.map((cc) => cc.date), 30, nowMs);
  const complaintsLast90d = countWithinDays(complaints.map((cc) => cc.date), 90, nowMs);

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
    scoreBreakdown: breakdown,
    airQuality: airQuality ? { pm25: airQuality.pm25 } : null,
    census: census ? { medianIncome: census.medianIncome } : null,
    radiusMeters: radius,
  });

  return {
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
      overpass: o.status === 'fulfilled' && o.value.result.amenities.length > 0
        ? 'ok'
        : o.status === 'fulfilled'
          ? 'partial'
          : 'failed',
      builddata: p.status === 'fulfilled' ? 'ok' : 'failed',
      complaints: c.status === 'fulfilled' ? 'ok' : 'failed',
      census: ce.status === 'fulfilled' && ce.value !== null ? 'ok' : 'skipped',
      weather: w.status === 'fulfilled' && w.value !== null ? 'ok' : 'skipped',
    },
    benchmarksCapturedAt: BENCHMARKS.capturedAt,
    schoolImpacts: schoolAnalysis.impacts,
  };
}

function computeDelta(a: NeighborhoodReport, b: NeighborhoodReport) {
  const breakdownDelta: Record<keyof ScoreBreakdown, number> = {
    amenityDensity: b.score.breakdown.amenityDensity - a.score.breakdown.amenityDensity,
    transitScore: b.score.breakdown.transitScore - a.score.breakdown.transitScore,
    foodAccess: b.score.breakdown.foodAccess - a.score.breakdown.foodAccess,
    greenSpace: b.score.breakdown.greenSpace - a.score.breakdown.greenSpace,
    development: b.score.breakdown.development - a.score.breakdown.development,
    civicScore: b.score.breakdown.civicScore - a.score.breakdown.civicScore,
    cultureScore: b.score.breakdown.cultureScore - a.score.breakdown.cultureScore,
    recreationScore: b.score.breakdown.recreationScore - a.score.breakdown.recreationScore,
    serviceScore: b.score.breakdown.serviceScore - a.score.breakdown.serviceScore,
  };
  const aBetter: string[] = [];
  const bBetter: string[] = [];
  for (const k of Object.keys(breakdownDelta) as (keyof ScoreBreakdown)[]) {
    if (breakdownDelta[k] > 0) aBetter.push(k);
    else if (breakdownDelta[k] < 0) bBetter.push(k);
  }
  return {
    total: b.score.total - a.score.total,
    breakdownDelta,
    aBetter,
    bBetter,
    anomaliesA: a.anomalies.length,
    anomaliesB: b.anomalies.length,
    aPermits: a.permits.length,
    bPermits: b.permits.length,
    aComplaints: a.complaints.length,
    bComplaints: b.complaints.length,
    aRadiusMeters: a.radiusMeters,
    bRadiusMeters: b.radiusMeters,
  };
}

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const a = url.searchParams.get('a')?.trim();
  const b = url.searchParams.get('b')?.trim();
  const radius = parseRadius(url.searchParams.get('radius'));

  if (!a || !b) {
    return NextResponse.json(
      { error: 'Missing ?a=<addr>&b=<addr>' },
      { status: 400 },
    );
  }

  const cacheKey = `${a}|${b}|${radius}`;
  const hit = compareCache.get(cacheKey);
  if (hit) {
    return NextResponse.json(hit);
  }

  if (url.searchParams.get('synth') === '1') {
    let aBody: ReturnType<typeof buildSyntheticReport>;
    let bBody: ReturnType<typeof buildSyntheticReport>;
    try {
      aBody = buildSyntheticReport(a, radius, false);
      bBody = buildSyntheticReport(b, radius, false);
    } catch (e) {
      log.error('compare.synth_build_failed', {
        a,
        b,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      });
      return NextResponse.json(
        { error: `Synthetic build failed: ${e instanceof Error ? e.message : 'unknown'}` },
        { status: 500 },
      );
    }
    if (!aBody && !bBody) {
      return NextResponse.json(
        {
          error: `No synthetic data for either "${a}" or "${b}". Try a known demo address.`,
        },
        { status: 404 },
      );
    }
    if (!aBody || !bBody) {
      const which = aBody ? `B="${b}"` : `A="${a}"`;
      return NextResponse.json(
        {
          error: `No synthetic data for ${which}. Try a known demo address (CN Tower, Liberty Village, Kensington Market, Scarborough Town Centre, North York Centre, 123 Queen St W).`,
        },
        { status: 404 },
      );
    }
    const repA = aBody as unknown as NeighborhoodReport;
    const repB = bBody as unknown as NeighborhoodReport;
    const response: ComparisonResponse = {
      a: repA,
      b: repB,
      delta: computeDelta(repA, repB),
      fetchedAt: new Date().toISOString(),
      radius,
    };
    try {
      return NextResponse.json(response);
    } catch (e) {
      log.error('compare.synth_respond_failed', {
        a,
        b,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      });
      return NextResponse.json(
        { error: `Synthetic response serialize failed: ${e instanceof Error ? e.message : 'unknown'}` },
        { status: 500 },
      );
    }
  }

  try {
    const [repA, repB] = await Promise.all([
      buildReport(a, radius, req.headers),
      buildReport(b, radius, req.headers),
    ]);
    const response: ComparisonResponse = {
      a: repA,
      b: repB,
      delta: computeDelta(repA, repB),
      fetchedAt: new Date().toISOString(),
      radius,
    };
    compareCache.set(cacheKey, response, CONFIG.cache.reportTtlMs);
    log.info('compare.ok', {
      a: repA.address.slice(0, 40),
      b: repB.address.slice(0, 40),
      deltaTotal: response.delta.total,
    });
    return NextResponse.json(response);
  } catch (err) {
    log.error('compare.failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Internal compare error' }, { status: 500 });
  }
}
