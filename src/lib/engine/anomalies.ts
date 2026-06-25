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

function signalFromAmenity(
  name: string,
  current: number,
  benchmarkKey:
    | 'restaurant'
    | 'cafe'
    | 'school'
    | 'grocery'
    | 'park'
    | 'transit'
    | 'construction'
    | 'complaints',
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

function radiusLabel(m: number): string {
  return m >= 1000 ? `${m / 1000}km` : `${m}m`;
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

function detectOne(
  s: Signal,
  out: Anomaly[],
  category: Anomaly['category'],
): void {
  const z = zscore(s.current, s.baseline);
  const absZ = Math.abs(z);
  const sev = severityFor(absZ);
  if (!sev) return;
  out.push({
    signal: s.name,
    zscore: z,
    severity: sev,
    message: buildMessage(s, z),
    category,
  });
}

export interface AnomalyContext {
  permitsLast30d: number;
  permitsLast6m: number;
  complaintsLast30d: number;
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
  radiusMeters?: number;
}

export function detectAnomalies(ctx: AnomalyContext): Anomaly[] {
  const r = radiusLabel(ctx.radiusMeters ?? 3000);
  const signals: Array<{ sig: Signal; category: Anomaly['category'] }> = [
    { sig: signalFromAmenity(`Restaurants in ${r}`, ctx.amenityCounts.restaurant, 'restaurant', 'places'), category: 'livability' },
    { sig: signalFromAmenity(`Cafés in ${r}`, ctx.amenityCounts.cafe, 'cafe', 'places'), category: 'livability' },
    { sig: signalFromAmenity(`Schools in ${r}`, ctx.amenityCounts.school, 'school', 'places'), category: 'livability' },
    { sig: signalFromAmenity(`Grocery in ${r}`, ctx.amenityCounts.grocery, 'grocery', 'stores'), category: 'livability' },
    { sig: signalFromAmenity(`Park areas in ${r}`, ctx.amenityCounts.park, 'park', 'areas'), category: 'livability' },
    { sig: signalFromAmenity(`Transit stops in ${r}`, ctx.amenityCounts.transit, 'transit', 'stops'), category: 'livability' },
    { sig: signalFromAmenity(`Construction sites in ${r}`, ctx.amenityCounts.construction, 'construction', 'sites'), category: 'gentrification' },
  ];

  if (ctx.permitsLast6m > 0) {
    // permits500m is the benchmark for permits within a 500m radius; we
    // divide its p50 by 6 to approximate a 6-month baseline for larger radii.
    const baseline = Math.max(1, Math.round(BENCHMARKS.metrics.permits500m.p50 / 6));
    signals.push({
      sig: {
        name: 'Building permits (last 6 months)',
        current: ctx.permitsLast6m,
        baseline,
        unit: 'permits',
      },
      category: 'gentrification',
    });
  }
  if (ctx.permitsLast30d > 0 && ctx.permitsLast6m > 4) {
    const baseline = Math.max(0.5, ctx.permitsLast6m / 6);
    signals.push({
      sig: {
        name: 'Permit surge (last 30d)',
        current: ctx.permitsLast30d,
        baseline,
        unit: 'permits/mo',
      },
      category: 'gentrification',
    });
  }
  if (ctx.complaintsLast90d > 0) {
    const baseline = Math.max(1, Math.round(BENCHMARKS.metrics.complaints.p50 / 3));
    signals.push({
      sig: {
        name: '311 complaints (last 90 days)',
        current: ctx.complaintsLast90d,
        baseline,
        unit: 'complaints',
      },
      category: 'quality-of-life',
    });
  }
  if (ctx.complaintsLast30d > 0 && ctx.complaintsLast90d > 2) {
    const baseline = Math.max(0.33, ctx.complaintsLast90d / 3);
    signals.push({
      sig: {
        name: '311 complaint surge (last 30d)',
        current: ctx.complaintsLast30d,
        baseline,
        unit: 'complaints/mo',
      },
      category: 'quality-of-life',
    });
  }
  if (ctx.permitsLast6m >= 5) {
    const ratio = ctx.permitsLast6m / Math.max(1, ctx.complaintsLast90d);
    const baseline = 1.5;
    signals.push({
      sig: {
        name: 'Gentrification pressure (permits/complaints)',
        current: Number(ratio.toFixed(2)),
        baseline,
        unit: 'ratio',
      },
      category: 'gentrification',
    });
  }
  if (ctx.airQuality) {
    signals.push({
      sig: {
        name: 'Air quality (PM2.5)',
        current: ctx.airQuality.pm25,
        baseline: 12,
        unit: 'µg/m³',
      },
      category: 'environment',
    });
  }
  if (ctx.census) {
    signals.push({
      sig: {
        name: 'Median household income',
        current: ctx.census.medianIncome,
        baseline: 65000,
        unit: 'USD',
      },
      category: 'livability',
    });
  }

  const anomalies: Anomaly[] = [];
  for (const { sig, category } of signals) detectOne(sig, anomalies, category);
  return anomalies.sort((a, b) => Math.abs(b.zscore) - Math.abs(a.zscore));
}
