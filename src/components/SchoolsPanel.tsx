import type { Amenity, LatLon, NeighborhoodReport } from '@/lib/types';
import { computeBreakdown, computeTotal } from '@/lib/engine/score';
import { haversineMeters } from '@/lib/utils/geo';
import { hasRealName, pickName } from '@/lib/utils/amenity';

interface Props {
  report: NeighborhoodReport;
}

interface SchoolImpact {
  amenity: Amenity;
  name: string;
  distanceKm: number;
  delta: number;
  hasName: boolean;
}

function distanceKm(a: Amenity, c: LatLon): number {
  return haversineMeters(a, c) / 1000;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(2)} km`;
}

function formatDelta(delta: number): string {
  if (delta <= 0) return '0.00';
  if (delta < 0.1) return delta.toFixed(2);
  return delta.toFixed(1);
}

function radiusLabel(m: number): string {
  return m >= 1000 ? `${m / 1000}KM` : `${m}M`;
}

export function SchoolsPanel({ report }: Props) {
  const center = report.coords;
  const schools = report.amenities.amenities
    .filter((a) => a.kind === 'school');
  const radius = report.radiusMeters ?? 1500;

  if (schools.length === 0) {
    return (
      <div className="flex flex-col gap-2 p-4 border border-[var(--color-border)] bg-[var(--color-surface)]">
        <h2 className="text-xs uppercase tracking-widest text-[var(--color-accent)] font-semibold border-b border-[var(--color-border)] pb-2">
          [ SCHOOLS // {radiusLabel(radius)} RADIUS ]
        </h2>
        <div className="text-xs text-[var(--color-text-mute)] uppercase tracking-wider py-2 text-center">
          [ NO SCHOOLS MAPPED IN {radiusLabel(radius).toUpperCase()} RADIUS ]
          <br />
          <span className="text-[10px]">
            SCHOOLS MAY EXIST BUT ARE NOT IN OPENSTREETMAP. TRY A LARGER RADIUS.
          </span>
        </div>
      </div>
    );
  }

  const computed = computeBreakdown(report.amenities.amenities, report.permits);
  const currentTotal = computeTotal(computed.breakdown, {
    presence: computed.presence,
  }).total;

  const impacts: SchoolImpact[] = schools.map((s) => {
    const without = report.amenities.amenities.filter((a) => a.id !== s.id);
    const alt = computeBreakdown(without, report.permits);
    const altTotal = computeTotal(alt.breakdown, { presence: alt.presence }).total;
    const name = pickName(s);
    return {
      amenity: s,
      name,
      distanceKm: distanceKm(s, center),
      delta: currentTotal - altTotal,
      hasName: hasRealName(s),
    };
  });

  impacts.sort((a, b) => b.delta - a.delta || a.distanceKm - b.distanceKm);

  const named = impacts.filter((i) => i.hasName);
  const unnamed = impacts.filter((i) => !i.hasName);

  return (
    <div className="flex flex-col gap-2 p-4 border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
        <h2 className="text-xs uppercase tracking-widest text-[var(--color-accent)] font-semibold">
          [ SCHOOLS // {schools.length} · {radiusLabel(radius).toUpperCase()} · INDIVIDUAL IMPACT ]
        </h2>
        <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider">
          COUNTERFACTUAL Δ
        </div>
      </div>

      <p className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider leading-relaxed">
        EACH ROW SHOWS WHAT THE TOTAL SCORE WOULD BE IF THIS SCHOOL WERE REMOVED. SORTED BY LARGEST CONTRIBUTION.
      </p>

      <ul className="border border-[var(--color-border)] bg-black divide-y divide-[var(--color-border)]">
        {named.length > 0 && (
          <li className="px-3 py-1 text-[10px] uppercase tracking-widest text-[var(--color-text-mute)] bg-[var(--color-surface-2)]">
            NAMED · {named.length}
          </li>
        )}
        {named.slice(0, 10).map((i) => (
          <li
            key={i.amenity.id}
            className="px-3 py-1.5 flex items-center justify-between gap-3 text-xs"
          >
            <span className="text-[var(--color-text)] truncate flex-1">
              {i.name}
            </span>
            <span className="text-[var(--color-text-mute)] tabular-nums whitespace-nowrap">
              {formatDistance(i.distanceKm)}
            </span>
            <span className="text-[var(--color-accent)] tabular-nums whitespace-nowrap w-16 text-right">
              +{formatDelta(i.delta)} pts
            </span>
          </li>
        ))}
        {named.length > 10 && (
          <li className="px-3 py-1 text-[10px] uppercase tracking-widest text-[var(--color-text-mute)]">
            + {named.length - 10} MORE NAMED SCHOOLS BELOW
          </li>
        )}
        {unnamed.length > 0 && (
          <li className="px-3 py-1 text-[10px] uppercase tracking-widest text-[var(--color-text-mute)] bg-[var(--color-surface-2)]">
            UNNAMED · {unnamed.length}
          </li>
        )}
        {unnamed.slice(0, 5).map((i) => (
          <li
            key={i.amenity.id}
            className="px-3 py-1.5 flex items-center justify-between gap-3 text-xs"
          >
            <span className="text-[var(--color-text-mute)] italic truncate flex-1">
              {i.name}
            </span>
            <span className="text-[var(--color-text-mute)] tabular-nums whitespace-nowrap">
              {formatDistance(i.distanceKm)}
            </span>
            <span className="text-[var(--color-text-mute)] tabular-nums whitespace-nowrap w-16 text-right">
              +{formatDelta(i.delta)} pts
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
