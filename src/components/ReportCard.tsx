import type { NeighborhoodReport } from '@/lib/types';

interface Props {
  report: NeighborhoodReport;
}

const LABELS: Record<keyof NeighborhoodReport['score']['breakdown'], string> = {
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

export function ReportCard({ report }: Props) {
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

  return (
    <div className="flex flex-col gap-4 p-4 border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
        <h2 className="text-xs uppercase tracking-widest text-[var(--color-accent)] font-semibold">
          [ LIVABILITY SCORE ]
        </h2>
        <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider">
          CITY_AVG {score.cityAverage}
        </div>
      </div>

      <div className="flex items-baseline gap-3">
        <div className={`text-6xl font-bold ${colorFor(score.total)} tabular-nums leading-none`}>
          {score.total}
        </div>
        <div className="text-[var(--color-text-mute)] text-sm">/100</div>
        <div className="ml-auto text-right">
          <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-widest">
            RANK
          </div>
          <div className={`text-sm font-semibold ${colorFor(score.total)} uppercase`}>
            {score.ranking.label}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {Object.entries(score.breakdown).map(([k, v]) => {
          const key = k as keyof typeof score.breakdown;
          return (
            <div key={k} className="flex items-center gap-3 text-xs">
              <div className="w-32 text-[var(--color-text-dim)] uppercase tracking-wider truncate">
                {LABELS[key]}
              </div>
              <div className="flex-1 h-1.5 bg-[var(--color-surface-3)] overflow-hidden">
                <div
                  className={`h-full ${barColorFor(v)} transition-all`}
                  style={{ width: `${v}%` }}
                />
              </div>
              <div className="w-10 text-right text-[var(--color-text)] tabular-nums">
                {String(v).padStart(3, '0')}
              </div>
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
