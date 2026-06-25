import type { NeighborhoodReport, ScoreBreakdown } from '@/lib/types';
import { computeRanking } from '@/lib/engine/score';

interface ModifiedView {
  breakdown: ScoreBreakdown;
  total: number;
  delta: number;
}

interface Props {
  report: NeighborhoodReport;
  modified?: ModifiedView | null;
}

const LABELS: Record<keyof ScoreBreakdown, string> = {
  amenityDensity: 'AMENITY DENSITY',
  transitScore: 'TRANSIT ACCESS',
  foodAccess: 'FOOD ACCESS',
  greenSpace: 'GREEN SPACE',
  development: 'DEVELOPMENT',
};

function colorFor(score: number): string {
  if (score >= 75) return 'text-[var(--color-accent)]';
  if (score >= 50) return 'text-[var(--color-warn)]';
  return 'text-[var(--color-bad)]';
}

function barColorFor(score: number): string {
  if (score >= 75) return 'bg-[var(--color-accent)]';
  if (score >= 50) return 'bg-[var(--color-warn)]';
  return 'bg-[var(--color-bad)]';
}

function deltaColor(d: number): string {
  if (d > 0) return 'text-[var(--color-accent)]';
  if (d < 0) return 'text-[var(--color-bad)]';
  return 'text-[var(--color-text-mute)]';
}

function deltaSign(d: number): string {
  if (d > 0) return `+${d}`;
  if (d < 0) return `${d}`;
  return '±0';
}

export function ReportCard({ report, modified }: Props) {
  const { score, amenities, permits, complaints, sources } = report;
  const counts = {
    restaurants: amenities.amenities.filter((a) => a.kind === 'restaurant').length,
    cafes: amenities.amenities.filter((a) => a.kind === 'cafe').length,
    schools: amenities.amenities.filter((a) => a.kind === 'school').length,
    groceries: amenities.amenities.filter((a) => a.kind === 'grocery').length,
    parks: amenities.amenities.filter((a) => a.kind === 'park').length,
    transit:
      amenities.amenities.filter(
        (a) => a.kind === 'bus_stop' || a.kind === 'transit',
      ).length + amenities.transit.length,
  };

  const isModified = Boolean(modified);
  const totalShown = modified ? modified.total : score.total;
  const totalOriginal = score.total;

  return (
    <div className={`flex flex-col gap-4 p-4 border bg-[var(--color-surface)] ${
      isModified ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]'
    }`}>
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
        <h2 className="text-xs uppercase tracking-widest text-[var(--color-accent)] font-semibold">
          [ LIVABILITY SCORE{isModified ? ' // WHAT-IF' : ''} ]
        </h2>
        <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider">
          CITY_AVG {score.cityAverage}
        </div>
      </div>

      <div className="flex items-baseline gap-3">
        <div className={`text-6xl font-bold ${colorFor(totalShown)} tabular-nums leading-none transition-colors`}>
          {totalShown}
        </div>
        <div className="text-[var(--color-text-mute)] text-sm">/100</div>
        {isModified && (
          <div className="flex flex-col text-xs">
            <div className="text-[var(--color-text-mute)] line-through tabular-nums">
              {totalOriginal}
            </div>
            <div className={`${deltaColor(modified!.delta)} font-semibold tabular-nums`}>
              {deltaSign(modified!.delta)} pts
            </div>
          </div>
        )}
        <div className="ml-auto text-right">
          <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-widest">
            RANK
          </div>
          <div className={`text-sm font-semibold ${colorFor(totalShown)} uppercase`}>
            {(modified ? computeRanking(totalShown).label : score.ranking.label)}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {(Object.keys(LABELS) as (keyof ScoreBreakdown)[]).map((key) => {
          const v = score.breakdown[key];
          const v2 = modified?.breakdown[key] ?? v;
          const d = v2 - v;
          const changed = d !== 0;
          return (
            <div key={key} className="flex items-center gap-3 text-xs">
              <div className="w-32 text-[var(--color-text-dim)] uppercase tracking-wider truncate">
                {LABELS[key]}
              </div>
              <div className="flex-1 h-1.5 bg-[var(--color-surface-3)] overflow-hidden relative">
                <div
                  className={`h-full ${barColorFor(v)} transition-all`}
                  style={{ width: `${v}%`, opacity: changed ? 0.3 : 1 }}
                />
                {changed && (
                  <div
                    className={`absolute top-0 left-0 h-full ${barColorFor(v2)} transition-all`}
                    style={{ width: `${v2}%` }}
                  />
                )}
              </div>
              <div className="w-10 text-right text-[var(--color-text)] tabular-nums">
                {String(v2).padStart(3, '0')}
              </div>
              {changed && (
                <div className={`w-12 text-right ${deltaColor(d)} tabular-nums text-[10px]`}>
                  {deltaSign(d)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs pt-2 border-t border-[var(--color-border)]">
        <div className="flex justify-between">
          <span className="text-[var(--color-text-mute)]">RESTAURANTS</span>
          <span className="text-[var(--color-text)] tabular-nums">{counts.restaurants}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-text-mute)]">CAFÉS</span>
          <span className="text-[var(--color-text)] tabular-nums">{counts.cafes}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-text-mute)]">SCHOOLS</span>
          <span className="text-[var(--color-text)] tabular-nums">{counts.schools}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-text-mute)]">GROCERY</span>
          <span className="text-[var(--color-text)] tabular-nums">{counts.groceries}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-text-mute)]">PARKS</span>
          <span className="text-[var(--color-text)] tabular-nums">{counts.parks}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-text-mute)]">TRANSIT</span>
          <span className="text-[var(--color-text)] tabular-nums">{counts.transit}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-text-mute)]">PERMITS</span>
          <span className="text-[var(--color-warn)] tabular-nums">{permits.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-text-mute)]">COMPLAINTS</span>
          <span className="text-[var(--color-bad)] tabular-nums">{complaints.length}</span>
        </div>
      </div>

      <div className="text-[10px] text-[var(--color-text-mute)] flex flex-wrap gap-x-2 gap-y-1 pt-2 border-t border-[var(--color-border)] uppercase tracking-wider">
        <span>OSM [{sources.overpass.toUpperCase()}]</span>
        <span className="text-[var(--color-text-mute)]">·</span>
        <span>PERMITS [{sources.builddata.toUpperCase()}]</span>
        <span className="text-[var(--color-text-mute)]">·</span>
        <span>311 [{sources.complaints.toUpperCase()}]</span>
        <span className="text-[var(--color-text-mute)]">·</span>
        <span>CENSUS [{sources.census.toUpperCase()}]</span>
        <span className="text-[var(--color-text-mute)]">·</span>
        <span>AIR [{sources.weather.toUpperCase()}]</span>
      </div>
    </div>
  );
}

