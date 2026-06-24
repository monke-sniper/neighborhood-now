import { NextResponse } from 'next/server';
import { geocode } from '@/lib/api/nominatim';
import { fetchOverpass } from '@/lib/api/overpass';
import { fetchPermits } from '@/lib/api/builddata';
import { fetchComplaints } from '@/lib/api/complaints';
import { fetchCensus } from '@/lib/api/census';
import { fetchAirQuality } from '@/lib/api/weather';
import { computeBreakdown, computeTotal } from '@/lib/engine/score';
import { detectAnomalies } from '@/lib/engine/anomalies';
import { forecastTrend } from '@/lib/engine/forecast';
import { TTLCache } from '@/lib/utils/cache';
import { CONFIG } from '@/lib/config';
import type { NeighborhoodReport, Signal } from '@/lib/types';

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

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const address = url.searchParams.get('address')?.trim();
  if (!address) {
    return NextResponse.json({ error: 'Missing ?address=' }, { status: 400 });
  }

  const cacheKey = normalizeAddress(address);
  const hit = reportCache.get(cacheKey);
  if (hit) return NextResponse.json(hit);

  try {
    const geo = await geocode(address);

    const [overpassRes, permitsRes, complaintsRes, censusRes, weatherRes] =
      await Promise.allSettled([
        fetchOverpass(geo),
        fetchPermits(geo),
        fetchComplaints(geo),
        fetchCensus(geo),
        fetchAirQuality(geo),
      ]);

    const amenities =
      overpassRes.status === 'fulfilled'
        ? overpassRes.value
        : { amenities: [], buildings: [], transit: [], landuse: [], rawCount: 0 };
    const permits = permitsRes.status === 'fulfilled' ? permitsRes.value : [];
    const complaints =
      complaintsRes.status === 'fulfilled' ? complaintsRes.value : [];
    const census = censusRes.status === 'fulfilled' ? censusRes.value : null;
    const airQuality = weatherRes.status === 'fulfilled' ? weatherRes.value : null;

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

    const signals: Signal[] = [
      {
        name: 'Building permits this month',
        current: permitCurrent,
        baseline: Number(permitBaseline.toFixed(2)),
        unit: 'permits',
      },
      {
        name: '311 complaints this month',
        current: complaintCurrent,
        baseline: Number(complaintBaseline.toFixed(2)),
        unit: 'complaints',
      },
    ];
    if (airQuality) {
      signals.push({
        name: 'Air quality (PM2.5)',
        current: airQuality.pm25,
        baseline: 12,
        unit: 'µg/m³',
      });
    }
    if (census) {
      signals.push({
        name: 'Median household income',
        current: census.medianIncome,
        baseline: 65000,
        unit: 'USD',
      });
    }

    const anomalies = detectAnomalies(signals);

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
        overpass: overpassRes.status === 'fulfilled' ? 'ok' : 'failed',
        builddata: permitsRes.status === 'fulfilled' ? 'ok' : 'failed',
        complaints:
          complaintsRes.status === 'fulfilled'
            ? complaints.length > 0
              ? 'ok'
              : 'skipped'
            : 'failed',
        census: censusRes.status === 'fulfilled' && census ? 'ok' : 'skipped',
        weather:
          weatherRes.status === 'fulfilled' && airQuality ? 'ok' : 'skipped',
      },
    };

    reportCache.set(cacheKey, report, CONFIG.cache.reportTtlMs);
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
