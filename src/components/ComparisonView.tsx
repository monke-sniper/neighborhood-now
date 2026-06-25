import type { CompareResponse } from '@/hooks/useCompareState';
import { tierFor } from '@/lib/engine/explain';
import { computeRanking } from '@/lib/engine/score';
import { CompareMap } from './CompareMap';

interface Props {
  result: CompareResponse;
  onReset: () => void;
}

const COMPONENT_LABELS: Record<keyof import('@/lib/types').ScoreBreakdown, string> = {
  amenityDensity: 'AMENITY',
  transitScore: 'TRANSIT',
  foodAccess: 'FOOD',
  greenSpace: 'GREEN',
  development: 'DEV',
  civicScore: 'CIVIC',
  cultureScore: 'CULTURE',
  recreationScore: 'RECREATION',
  serviceScore: 'SERVICE',
};

function scoreColor(n: number): string {
  if (n >= 75) return 'text-[var(--color-accent)]';
  if (n >= 50) return 'text-[var(--color-warn)]';
  return 'text-[var(--color-bad)]';
}

function deltaColor(n: number): string {
  if (n > 0) return 'text-[var(--color-accent)]';
  if (n < 0) return 'text-[var(--color-bad)]';
  return 'text-[var(--color-text-mute)]';
}

function deltaSign(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${n}`;
  return '±0';
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function MiniReport({ label, report }: { label: string; report: import('@/lib/types').NeighborhoodReport }) {
  return (
    <div className="flex flex-col gap-2 p-3 border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
        <h3 className="text-[10px] uppercase tracking-widest text-[var(--color-accent)] font-semibold">
          [ {label} ]
        </h3>
        <span className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider">
          {report.radiusMeters >= 1000 ? `${report.radiusMeters / 1000}KM` : `${report.radiusMeters}M`} RADIUS
        </span>
      </div>
      <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider truncate" title={report.address}>
        {truncate(report.address, 60)}
      </div>
      <div className="flex items-baseline gap-3">
        <div className={`text-4xl font-bold ${scoreColor(report.score.total)} tabular-nums leading-none`}>
          {report.score.total}
        </div>
        <div className="text-[var(--color-text-mute)] text-xs">/ {report.score.maxPossible}</div>
        <div className="ml-auto text-right">
          <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-widest">RANK</div>
          <div className={`text-xs font-semibold ${scoreColor(report.score.total)} uppercase`}>
            {computeRanking(report.score.total).label}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] pt-2 border-t border-[var(--color-border)]">
        {(Object.keys(report.score.breakdown) as (keyof import('@/lib/types').ScoreBreakdown)[]).map((k) => {
          const v = report.score.breakdown[k];
          return (
            <div key={k} className="flex justify-between gap-2">
              <span className="text-[var(--color-text-mute)] truncate">{COMPONENT_LABELS[k]}</span>
              <span className={`${scoreColor(v)} tabular-nums`}>{String(v).padStart(2, '0')}</span>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-[var(--color-text-mute)] flex flex-wrap gap-x-2 gap-y-1 pt-2 border-t border-[var(--color-border)] uppercase tracking-wider">
        <span>PERMITS <span className="text-[var(--color-warn)]">{report.permits.length}</span></span>
        <span className="text-[var(--color-text-mute)]">·</span>
        <span>311 <span className="text-[var(--color-bad)]">{report.complaints.length}</span></span>
        <span className="text-[var(--color-text-mute)]">·</span>
        <span>ANOMALIES <span className="text-[var(--color-accent)]">{report.anomalies.length}</span></span>
      </div>
    </div>
  );
}

export function ComparisonView({ result, onReset }: Props) {
  const { a, b, delta } = result;
  const winner = delta.total === 0 ? null : delta.total > 0 ? 'B' : 'A';
  const componentTie = delta.aBetter.length === delta.bBetter.length;
  void tierFor;

  return (
    <div className="flex flex-col gap-3 p-4 border border-[var(--color-accent)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
        <h2 className="text-xs uppercase tracking-widest text-[var(--color-accent)] font-semibold">
          [ COMPARE // {winner ? `B WINS BY ${Math.abs(delta.total)} PTS` : 'TIED'} ]
        </h2>
        <button
          type="button"
          onClick={onReset}
          className="text-[10px] text-[var(--color-text-mute)] hover:text-[var(--color-accent)] uppercase tracking-widest border border-[var(--color-border)] px-2 py-0.5"
        >
          [ RESET ]
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MiniReport label="A" report={a} />
        <MiniReport label="B" report={b} />
      </div>
      <CompareMap a={a} b={b} radiusMeters={a.radiusMeters} />
      <div className="border border-[var(--color-border)] bg-black p-3">
        <h3 className="text-[10px] uppercase tracking-widest text-[var(--color-accent)] font-semibold mb-2">
          [ COMPONENT-BY-COMPONENT DELTA (B - A) ]
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {(Object.keys(delta.breakdownDelta) as (keyof import('@/lib/types').ScoreBreakdown)[]).map((k) => {
            const d = delta.breakdownDelta[k];
            return (
              <div key={k} className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] py-1">
                <span className="text-[var(--color-text-dim)] uppercase tracking-wider w-24 truncate">
                  {COMPONENT_LABELS[k]}
                </span>
                <span className="text-[var(--color-text-mute)] tabular-nums text-[10px]">
                  {String(a.score.breakdown[k]).padStart(2, '0')} → {String(b.score.breakdown[k]).padStart(2, '0')}
                </span>
                <span className={`${deltaColor(d)} tabular-nums w-12 text-right font-semibold`}>
                  {deltaSign(d)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
        <div className="border border-[var(--color-border)] bg-black p-2 flex flex-col">
          <span className="text-[var(--color-text-mute)] uppercase tracking-wider">[ A WINS ]</span>
          <span className={`font-semibold ${delta.aBetter.length > delta.bBetter.length ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]'}`}>{delta.aBetter.length}/9</span>
        </div>
        <div className="border border-[var(--color-border)] bg-black p-2 flex flex-col">
          <span className="text-[var(--color-text-mute)] uppercase tracking-wider">[ B WINS ]</span>
          <span className={`font-semibold ${delta.bBetter.length > delta.aBetter.length ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]'}`}>{delta.bBetter.length}/9</span>
        </div>
        {componentTie && (
          <div className="border border-[var(--color-warn)] bg-black p-2 flex flex-col col-span-2 sm:col-span-2">
            <span className="text-[var(--color-warn)] uppercase tracking-wider">[ TIE ]</span>
            <span className="text-[var(--color-warn)] font-semibold">
              {delta.aBetter.length} COMPONENTS EACH
              {winner === null ? ' · IDENTICAL TOTAL' : ` · ${winner} WINS ON TOTAL BY ${Math.abs(delta.total)} PTS`}
            </span>
          </div>
        )}
        <div className="border border-[var(--color-border)] bg-black p-2 flex flex-col">
          <span className="text-[var(--color-text-mute)] uppercase tracking-wider">[ ANOMALIES ]</span>
          <span className="text-[var(--color-text)] font-semibold">
            {delta.anomaliesA} <span className="text-[var(--color-text-mute)]">vs</span> {delta.anomaliesB}
          </span>
        </div>
        <div className="border border-[var(--color-border)] bg-black p-2 flex flex-col">
          <span className="text-[var(--color-text-mute)] uppercase tracking-wider">[ 311 CALLS ]</span>
          <span className="text-[var(--color-text)] font-semibold">
            {delta.aComplaints} <span className="text-[var(--color-text-mute)]">vs</span> {delta.bComplaints}
          </span>
        </div>
      </div>
    </div>
  );
}
