import { BENCHMARKS } from './benchmarks';
import type { Anomaly, ScoreBreakdown, Signal } from '../types';

const ZSCORE_THRESHOLD = 1.8;

function zscore(current: number, baseline: number): number {
  if (baseline <= 0) {
    if (current > 0) return 3;
    return 0;
  }
  return (current - baseline) / Math.sqrt(baseline);
}

function signalFromScore(
  name: string,
  current: number,
  benchmarkP50: number,
  unit: string,
): Signal {
  return { name, current, baseline: benchmarkP50, unit };
}

function signalFromAmenity(
  name: string,
  current: number,
  benchmarkKey: 'restaurant' | 'cafe' | 'school' | 'grocery' | 'park' | 'transit' | 'construction' | 'complaints',
  unit: string,
): Signal {
  const b = BENCHMARKS.metrics[benchmarkKey];
  return {
    name,
    current,
    baseline: b.p50,
    unit,
  };
}

function severityFor(absZ: number): Anomaly['severity'] | null {
  if (absZ > 3) return 'critical';
  if (absZ > ZSCORE_THRESHOLD) return 'warning';
  return null;
}

function buildMessage(s: Signal, z: number): string {
  const direction = z >= 0 ? 'above' : 'below';
  const sev = Math.abs(z) > 3 ? 'significantly' : '';
  return `${s.name} is ${sev} ${direction} normal: ${s.current} ${s.unit} (baseline ${Math.round(s.baseline)} ${s.unit}, ${z.toFixed(1)}σ)`;
}

function detectOne(s: Signal, out: Anomaly[]): void {
  const z = zscore(s.current, s.baseline);
  const absZ = Math.abs(z);
  const sev = severityFor(absZ);
  if (!sev) return;
  out.push({
    signal: s.name,
    zscore: z,
    severity: sev,
    message: buildMessage(s, z),
  });
}

export interface AnomalyContext {
  permitsLast6m: number;
  complaintsLast90d: number;
  amenityCounts: {
    restaurant: number;
    cafe: number;
    school: number;
    grocery: number;
    park: number;
    transit: number;
    construction: number;
  };
  scoreBreakdown: ScoreBreakdown;
  airQuality: { pm25: number } | null;
  census: { medianIncome: number } | null;
}

export function detectAnomalies(ctx: AnomalyContext): Anomaly[] {
  const signals: Signal[] = [
    signalFromScore('Overall livability', ctx.scoreBreakdown.amenityDensity, BENCHMARKS.metrics.restaurant.p50, 'pts'),
    signalFromScore('Transit access', ctx.scoreBreakdown.transitScore, BENCHMARKS.metrics.transit.p50, 'pts'),
    signalFromScore('Food access', ctx.scoreBreakdown.foodAccess, BENCHMARKS.metrics.grocery.p50, 'pts'),
    signalFromScore('Green space', ctx.scoreBreakdown.greenSpace, BENCHMARKS.metrics.park.p50, 'pts'),
    signalFromScore('Development activity', ctx.scoreBreakdown.development, BENCHMARKS.metrics.construction.p50, 'pts'),
    signalFromAmenity('Restaurants in 1500m', ctx.amenityCounts.restaurant, 'restaurant', 'places'),
    signalFromAmenity('Cafés in 1500m', ctx.amenityCounts.cafe, 'cafe', 'places'),
    signalFromAmenity('Schools in 1500m', ctx.amenityCounts.school, 'school', 'places'),
    signalFromAmenity('Grocery in 1500m', ctx.amenityCounts.grocery, 'grocery', 'stores'),
    signalFromAmenity('Park areas in 1500m', ctx.amenityCounts.park, 'park', 'areas'),
    signalFromAmenity('Transit stops in 1500m', ctx.amenityCounts.transit, 'transit', 'stops'),
    signalFromAmenity('Construction sites in 1500m', ctx.amenityCounts.construction, 'construction', 'sites'),
  ];

  if (ctx.permitsLast6m > 0) {
    signals.push({
      name: 'Building permits (last 6 months)',
      current: ctx.permitsLast6m,
      baseline: Math.max(1, Math.round(BENCHMARKS.metrics.permits500m.p50)),
      unit: 'permits',
    });
  }
  if (ctx.complaintsLast90d > 0) {
    signals.push({
      name: '311 complaints (last 90 days)',
      current: ctx.complaintsLast90d,
      baseline: Math.max(1, Math.round(BENCHMARKS.metrics.complaints.p50)),
      unit: 'complaints',
    });
  }
  if (ctx.airQuality) {
    signals.push({
      name: 'Air quality (PM2.5)',
      current: ctx.airQuality.pm25,
      baseline: 12,
      unit: 'µg/m³',
    });
  }
  if (ctx.census) {
    signals.push({
      name: 'Median household income',
      current: ctx.census.medianIncome,
      baseline: 65000,
      unit: 'USD',
    });
  }

  const anomalies: Anomaly[] = [];
  for (const s of signals) detectOne(s, anomalies);
  return anomalies.sort((a, b) => Math.abs(b.zscore) - Math.abs(a.zscore));
}
