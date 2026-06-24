import type { Anomaly } from '@/lib/types';

interface Props {
  anomalies: Anomaly[];
}

function severityStyle(sev: Anomaly['severity']): {
  border: string;
  bg: string;
  pillBg: string;
  pillText: string;
} {
  if (sev === 'critical') {
    return {
      border: 'border-[var(--color-bad)]',
      bg: 'bg-[#1a0606]',
      pillBg: 'bg-[var(--color-bad)]',
      pillText: 'text-black',
    };
  }
  return {
    border: 'border-[var(--color-warn)]',
    bg: 'bg-[#1a1303]',
    pillBg: 'bg-[var(--color-warn)]',
    pillText: 'text-black',
  };
}

export function AnomalyList({ anomalies }: Props) {
  if (anomalies.length === 0) {
    return (
      <div className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-text-mute)] uppercase tracking-wider">
        [ NO ANOMALIES DETECTED // ALL SIGNALS WITHIN NORMAL RANGE ]
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4 border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
        <h2 className="text-xs uppercase tracking-widest text-[var(--color-accent)] font-semibold">
          [ ANOMALIES // {anomalies.length} ]
        </h2>
        <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider">
          Z-SCORE THRESHOLD: ±1.8σ
        </div>
      </div>
      {anomalies.slice(0, 6).map((a, i) => {
        const style = severityStyle(a.severity);
        return (
          <div
            key={`${a.signal}-${i}`}
            className={`flex items-start gap-3 p-2 border ${style.border} ${style.bg}`}
          >
            <div
              className={`text-[10px] uppercase tracking-widest px-2 py-0.5 font-bold ${style.pillBg} ${style.pillText}`}
            >
              {a.severity === 'critical' ? 'CRIT' : 'WARN'}
            </div>
            <div className="text-xs text-[var(--color-text)] flex-1 leading-relaxed">
              {a.message}
            </div>
            <div className="text-[10px] text-[var(--color-text-mute)] tabular-nums whitespace-nowrap">
              {a.zscore > 0 ? '+' : ''}{a.zscore.toFixed(1)}σ
            </div>
          </div>
        );
      })}
    </div>
  );
}
