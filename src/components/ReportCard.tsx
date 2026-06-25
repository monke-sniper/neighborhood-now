import type { NeighborhoodReport, ScoreBreakdown } from '@/lib/types';
import { computeRanking } from '@/lib/engine/score';
import { tierFor } from '@/lib/engine/explain';
import { ScoreBar } from './ScoreBar';

interface ModifiedView {
  breakdown: ScoreBreakdown;
  total: number;
  delta: number;
}

interface Props {
  report: NeighborhoodReport;
  modified?: ModifiedView | null;
}

function colorFor(score: number): string {
  if (score >= 75) return 'text-[var(--color-accent)]';
  if (score >= 50) return 'text-[var(--color-warn)]';
  return 'text-[var(--color-bad)]';
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
  const { score, explanations, amenities, permits, complaints, sources, radiusMeters } = report;
  const counts = {
    restaurants: amenities.amenities.filter((a) => a.kind === 'restaurant').length,
    cafes: amenities.amenities.filter((a) => a.kind === 'cafe').length,
    schools: amenities.amenities.filter((a) => a.kind === 'school').length,
    groceries: amenities.amenities.filter((a) => a.kind === 'grocery').length,
    parks: amenities.amenities.filter((a) => a.kind === 'park').length,
    recreation: amenities.amenities.filter((a) => a.kind === 'recreation').length,
    civic: amenities.amenities.filter((a) => a.kind === 'civic').length,
    culture: amenities.amenities.filter((a) => a.kind === 'culture').length,
    service: amenities.amenities.filter((a) => a.kind === 'service').length,
    transit:
      amenities.amenities.filter(
        (a) => a.kind === 'bus_stop' || a.kind === 'transit',
      ).length + amenities.transit.length,
  };

  const isModified = Boolean(modified);
  const totalShown = modified ? modified.total : score.total;
  const totalOriginal = score.total;
  const maxPossible = score.maxPossible;
  const radiusKm = radiusMeters >= 1000 ? `${radiusMeters / 1000}km` : `${radiusMeters}m`;
  const missingCount = (Object.values(score.presence) as boolean[]).filter(
    (v) => !v,
  ).length;

  return (
    <div
      className={`flex flex-col gap-4 p-4 border bg-[var(--color-surface)] ${
        isModified ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]'
      }`}
    >
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
        <h2 className="text-xs uppercase tracking-widest text-[var(--color-accent)] font-semibold">
          [ LIVABILITY SCORE{isModified ? ' // WHAT-IF' : ''} ]
        </h2>
        <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider">
          {radiusKm} RADIUS · {score.cityAverage} CITY_AVG
        </div>
      </div>

      <div className="flex items-baseline gap-3">
        <div
          className={`text-6xl font-bold ${colorFor(totalShown)} tabular-nums leading-none transition-colors`}
        >
          {maxPossible === 0 ? '—' : totalShown}
        </div>
        <div className="text-[var(--color-text-mute)] text-sm">
          / {maxPossible === 0 ? '—' : maxPossible}
        </div>
        {isModified && (
          <div className="flex flex-col text-xs">
            <div className="text-[var(--color-text-mute)] line-through tabular-nums">
              {totalOriginal}
            </div>
            <div
              className={`${deltaColor(modified!.delta)} font-semibold tabular-nums`}
            >
              {deltaSign(modified!.delta)} pts
            </div>
          </div>
        )}
        <div className="ml-auto text-right">
          <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-widest">
            RANK
          </div>
          <div
            className={`text-sm font-semibold ${colorFor(totalShown)} uppercase`}
          >
            {(modified ? computeRanking(totalShown).label : score.ranking.label)}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {explanations.map((e) => {
          const modifiedScore =
            modified && isModified ? modified.breakdown[e.key] : null;
          const modifiedTier =
            modifiedScore != null ? tierFor(modifiedScore) : null;
          return (
            <ScoreBar
              key={e.key}
              explanation={e}
              isModified={isModified}
              modifiedScore={modifiedScore}
              modifiedTier={modifiedTier}
            />
          );
        })}
      </div>

      <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider pt-1 border-t border-[var(--color-border)] leading-relaxed">
        [ HOW ] SCORE OUT OF {maxPossible} ({missingCount > 0 ? `${9 - missingCount}/9 COMPONENTS WITH DATA, OTHERS EXCLUDED` : 'ALL 9 COMPONENTS'}).
        EACH IS PERCENTILE-RANKED AGAINST {report.benchmarksCapturedAt ? `TORONTO BENCHMARKS CAPTURED ${new Date(report.benchmarksCapturedAt).toISOString().slice(0, 10)}` : 'LIVE TORONTO BENCHMARKS'}.
        CLICK [+] FOR THE FULL BREAKDOWN.
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
          <span className="text-[var(--color-text-mute)]">RECREATION</span>
          <span className="text-[var(--color-text)] tabular-nums">{counts.recreation}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-text-mute)]">CIVIC</span>
          <span className="text-[var(--color-text)] tabular-nums">{counts.civic}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-text-mute)]">CULTURE</span>
          <span className="text-[var(--color-text)] tabular-nums">{counts.culture}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-text-mute)]">SERVICES</span>
          <span className="text-[var(--color-text)] tabular-nums">{counts.service}</span>
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
