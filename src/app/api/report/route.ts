import { NextResponse } from 'next/server';
import { geocode } from '@/lib/api/nominatim';
import { fetchOverpass } from '@/lib/api/overpass';
import { fetchPermits } from '@/lib/api/builddata';
import { fetchComplaints } from '@/lib/api/complaints';
import { fetchCensus } from '@/lib/api/census';
import { fetchAirQuality } from '@/lib/api/weather';
import { computeBreakdown, computeTotal } from '@/lib/engine/score';
import { detectAnomalies, type AnomalyContext } from '@/lib/engine/anomalies';
import { forecastTrend } from '@/lib/engine/forecast';
import { log } from '@/lib/logger';
import { TTLCache } from '@/lib/utils/cache';
import { CONFIG } from '@/lib/config';
import type { NeighborhoodReport } from '@/lib/types';

export const dynamic = 'force-dynamic';

const reportCache = new TTLCache<string, NeighborhoodReport>();

function normalizeAddress(a: string): string {
  return a.trim().toLowerCase().replace(/\s+/g, ' ');
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function lastNMonths(n: number, from = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - i, 1));
    out.push(monthKey(d));
  }
  return out;
}

function seriesFromDates(dates: string[], months: string[]): number[] {
  const counts = new Map<string, number>();
  for (const m of months) counts.set(m, 0);
  for (const d of dates) {
    const t = Date.parse(d);
    if (!Number.isFinite(t)) continue;
    const k = monthKey(new Date(t));
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return months.map((m) => counts.get(m) ?? 0);
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
  if (!address) {
    return NextResponse.json({ error: 'Missing ?address=' }, { status: 400 });
  }

  const cacheKey = normalizeAddress(address);
  if (!debug) {
    const hit = reportCache.get(cacheKey);
    if (hit) {
      log.debug('report.cache_hit', { address: cacheKey });
      return NextResponse.json(hit);
    }
  }

  try {
    const geo = await geocode(address);

    const [o, p, c, ce, w] = await Promise.all([
      timed(() => fetchOverpass(geo)),
      timed(() => fetchPermits(geo)),
      timed(() => fetchComplaints(geo)),
      timed(() => fetchCensus(geo)),
      timed(() => fetchAirQuality(geo)),
    ]);

    const amenities = o.ok
      ? o.value
      : { amenities: [], buildings: [], transit: [], landuse: [], rawCount: 0 };
    const permits = p.ok ? p.value : [];
    const complaints = c.ok ? c.value : [];
    const census = ce.ok ? ce.value : null;
    const airQuality = w.ok ? w.value : null;

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
    });

    const breakdown = computeBreakdown(amenities.amenities, permits);
    const score = computeTotal(breakdown);

    const months = lastNMonths(12);
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

    const permitCurrent = permitsByMonth[permitsByMonth.length - 1] ?? 0;
    const complaintCurrent = complaintsByMonth[complaintsByMonth.length - 1] ?? 0;
    const permitBaseline =
      permitsByMonth.length > 1
        ? permitsByMonth.slice(0, -1).reduce((a, b) => a + b, 0) /
          (permitsByMonth.length - 1)
        : 0;
    const complaintBaseline =
      complaintsByMonth.length > 1
        ? complaintsByMonth.slice(0, -1).reduce((a, b) => a + b, 0) /
          (complaintsByMonth.length - 1)
        : 0;

    void permitCurrent;
    void permitBaseline;
    void complaintBaseline;

    const nowMs = Date.now();
    const sixMonthsMs = 1000 * 60 * 60 * 24 * 30 * 6;
    const ninetyDaysMs = 1000 * 60 * 60 * 24 * 90;
    const permitsLast6m = permits.filter((p) => {
      const t = Date.parse(p.issuedDate);
      return Number.isFinite(t) && nowMs - t <= sixMonthsMs;
    }).length;
    const complaintsLast90d = complaints.filter((cc) => {
      const t = Date.parse(cc.date);
      return Number.isFinite(t) && nowMs - t <= ninetyDaysMs;
    }).length;

    const amenityCounts = {
      restaurant: amenities.amenities.filter((a) => a.kind === 'restaurant').length,
      cafe: amenities.amenities.filter((a) => a.kind === 'cafe').length,
      school: amenities.amenities.filter((a) => a.kind === 'school').length,
      grocery: amenities.amenities.filter((a) => a.kind === 'grocery').length,
      park: amenities.amenities.filter((a) => a.kind === 'park').length,
      transit:
        amenities.amenities.filter(
          (a) => a.kind === 'bus_stop' || a.kind === 'transit',
        ).length + amenities.transit.length,
      construction: amenities.amenities.filter(
        (a) => a.kind === 'construction',
      ).length,
    };

    const anomalyCtx: AnomalyContext = {
      permitsLast6m,
      complaintsLast90d,
      amenityCounts,
      scoreBreakdown: breakdown,
      airQuality: airQuality ? { pm25: airQuality.pm25 } : null,
      census: census ? { medianIncome: census.medianIncome } : null,
    };

    const anomalies = detectAnomalies(anomalyCtx);

    const report: NeighborhoodReport = {
      address: geo.displayName,
      coords: { lat: geo.lat, lon: geo.lon },
      fetchedAt: new Date().toISOString(),
      score,
      amenities,
      permits,
      complaints,
      anomalies,
      trends,
      sources: {
        overpass: o.ok ? 'ok' : 'failed',
        builddata: p.ok ? 'ok' : 'failed',
        complaints: c.ok
          ? complaints.length > 0
            ? 'ok'
            : 'skipped'
          : 'failed',
        census: ce.ok && census ? 'ok' : 'skipped',
        weather: w.ok && airQuality ? 'ok' : 'skipped',
      },
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
        (CONFIG.overpass.radiusMeters / 1000) ** 2 * Math.PI;
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
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
