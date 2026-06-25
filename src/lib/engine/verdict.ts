import type {
  Amenity,
  NeighborhoodReport,
  ScoreBreakdown,
} from '../types';

export type VerdictKey =
  | 'gentrification'
  | 'transit_rich'
  | 'transit_desert'
  | 'food_desert'
  | 'food_abundant'
  | 'green_oasis'
  | 'park_poor'
  | 'civic_strong'
  | 'service_strong'
  | 'quiet_block'
  | 'amenity_thick';

export interface Verdict {
  key: VerdictKey;
  label: string;
  short: string;
  reason: string;
  emoji: string;
}

const LABELS: Record<VerdictKey, { label: string; short: string; emoji: string }> = {
  gentrification: { label: 'GENTRIFICATION FRONT-RUNNER', short: 'GENTRIFYING', emoji: 'G' },
  transit_rich: { label: 'TRANSIT-RICH', short: 'TRANSIT', emoji: 'T' },
  transit_desert: { label: 'TRANSIT DESERT', short: 'NO TRANSIT', emoji: 'X' },
  food_desert: { label: 'FOOD DESERT', short: 'FOOD DESERT', emoji: '-' },
  food_abundant: { label: 'GROCERY ABUNDANT', short: 'GROCERY', emoji: '+' },
  green_oasis: { label: 'GREEN OASIS', short: 'GREEN', emoji: 'P' },
  park_poor: { label: 'PARK-POOR', short: 'NO PARKS', emoji: '.' },
  civic_strong: { label: 'CIVIC-RICH', short: 'CIVIC', emoji: 'C' },
  service_strong: { label: 'SERVICE-SATURATED', short: 'SERVICES', emoji: 'S' },
  quiet_block: { label: 'LOW COMPLAINT', short: 'QUIET', emoji: 'Q' },
  amenity_thick: { label: 'AMENITY-THICK', short: 'AMENITY', emoji: 'A' },
};

function pct(n: number): string {
  return `${Math.round(n)}/100`;
}

export function deriveVerdicts(report: NeighborhoodReport): Verdict[] {
  const b: ScoreBreakdown = report.score.breakdown;
  const anomalies = report.anomalies;
  const amenities: Amenity[] = report.amenities.amenities;
  const out: Verdict[] = [];

  const permitsLast6m = anomalies.find((a) =>
    a.signal.startsWith('Building permits'),
  );
  const gentPressure = anomalies.find(
    (a) => a.signal === 'Gentrification pressure (permits/complaints)',
  );
  if (
    (permitsLast6m && permitsLast6m.zscore > 0) ||
    (gentPressure && gentPressure.zscore > 1.8)
  ) {
    const permitMsg = permitsLast6m
      ? `${permitsLast6m.signal} (${permitsLast6m.zscore.toFixed(1)}σ)`
      : 'no live permit count';
    const pressureMsg = gentPressure
      ? `${gentPressure.message}`
      : 'complaint pressure not elevated';
    out.push({
      key: 'gentrification',
      label: LABELS.gentrification.label,
      short: LABELS.gentrification.short,
      emoji: LABELS.gentrification.emoji,
      reason: `Development activity is running hot: ${permitMsg}; ${pressureMsg}. Expect rent + retail churn in the next 6–12 months.`,
    });
  }

  if (b.transitScore >= 75) {
    out.push({
      key: 'transit_rich',
      label: LABELS.transit_rich.label,
      short: LABELS.transit_rich.short,
      emoji: LABELS.transit_rich.emoji,
      reason: `Transit score ${pct(b.transitScore)} — top quartile for the city. Most daily trips can be done without a car.`,
    });
  } else if (b.transitScore < 35) {
    out.push({
      key: 'transit_desert',
      label: LABELS.transit_desert.label,
      short: LABELS.transit_desert.short,
      emoji: LABELS.transit_desert.emoji,
      reason: `Transit score ${pct(b.transitScore)} — bottom quartile. Car ownership is effectively required here.`,
    });
  }

  const groceryCount = amenities.filter((a) => a.kind === 'grocery').length;
  if (groceryCount === 0 || b.foodAccess < 30) {
    out.push({
      key: 'food_desert',
      label: LABELS.food_desert.label,
      short: LABELS.food_desert.short,
      emoji: LABELS.food_desert.emoji,
      reason: `Only ${groceryCount} grocery store${groceryCount === 1 ? '' : 's'} in the analysis radius. Food access score ${pct(b.foodAccess)}.`,
    });
  } else if (b.foodAccess >= 80) {
    out.push({
      key: 'food_abundant',
      label: LABELS.food_abundant.label,
      short: LABELS.food_abundant.short,
      emoji: LABELS.food_abundant.emoji,
      reason: `${groceryCount} grocery stores nearby; food access ${pct(b.foodAccess)}.`,
    });
  }

  const parkCount = amenities.filter((a) => a.kind === 'park').length;
  if (b.greenSpace >= 75) {
    out.push({
      key: 'green_oasis',
      label: LABELS.green_oasis.label,
      short: LABELS.green_oasis.short,
      emoji: LABELS.green_oasis.emoji,
      reason: `${parkCount} park${parkCount === 1 ? '' : 's'} in radius; green space ${pct(b.greenSpace)}.`,
    });
  } else if (b.greenSpace < 30 && parkCount <= 1) {
    out.push({
      key: 'park_poor',
      label: LABELS.park_poor.label,
      short: LABELS.park_poor.short,
      emoji: LABELS.park_poor.emoji,
      reason: `${parkCount} park${parkCount === 1 ? '' : 's'} in radius; green space ${pct(b.greenSpace)}. Walkable greenery is scarce.`,
    });
  }

  if (b.civicScore >= 70) {
    out.push({
      key: 'civic_strong',
      label: LABELS.civic_strong.label,
      short: LABELS.civic_strong.short,
      emoji: LABELS.civic_strong.emoji,
      reason: `Civic score ${pct(b.civicScore)} — community services, healthcare, and government are well represented.`,
    });
  }

  if (b.serviceScore >= 75) {
    out.push({
      key: 'service_strong',
      label: LABELS.service_strong.label,
      short: LABELS.service_strong.short,
      emoji: LABELS.service_strong.emoji,
      reason: `Service density ${pct(b.serviceScore)} — pharmacies, banks, salons and convenience retail are within easy reach.`,
    });
  }

  const complaintAnomaly = anomalies.find(
    (a) => a.signal.startsWith('311') || a.signal.startsWith('311 complaint'),
  );
  if (complaintAnomaly && complaintAnomaly.zscore < -1.5) {
    out.push({
      key: 'quiet_block',
      label: LABELS.quiet_block.label,
      short: LABELS.quiet_block.short,
      emoji: LABELS.quiet_block.emoji,
      reason: `${complaintAnomaly.signal} (${complaintAnomaly.zscore.toFixed(1)}σ) — fewer noise / property / sanitation issues than typical.`,
    });
  }

  if (b.amenityDensity >= 80) {
    out.push({
      key: 'amenity_thick',
      label: LABELS.amenity_thick.label,
      short: LABELS.amenity_thick.short,
      emoji: LABELS.amenity_thick.emoji,
      reason: `Amenity density ${pct(b.amenityDensity)} — restaurants, cafés and schools are stacked densely.`,
    });
  }

  return out;
}

export function summarizeVerdict(verdicts: Verdict[]): string {
  if (verdicts.length === 0) {
    return 'A middle-of-the-pack neighborhood by every measure we track. No signals stand out as either unusually good or unusually bad.';
  }
  const primary = verdicts[0]!;
  return `${primary.label}. ${primary.reason}`;
}
