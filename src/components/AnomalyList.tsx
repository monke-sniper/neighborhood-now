import type { Anomaly } from '@/lib/types';

interface Props {
  anomalies: Anomaly[];
}

export function AnomalyList({ anomalies }: Props) {
  if (anomalies.length === 0) {
    return (
      <div className="p-4 rounded border border-zinc-800 bg-zinc-900/50 text-sm text-zinc-500">
        No anomalies detected. All signals are within normal range.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4 rounded border border-zinc-800 bg-zinc-900/50">
      <h2 className="text-sm uppercase tracking-widest text-zinc-400">
        Anomalies ({anomalies.length})
      </h2>
      {anomalies.map((a, i) => {
        const isCritical = a.severity === 'critical';
        return (
          <div
            key={`${a.signal}-${i}`}
            className={`flex items-start gap-3 p-2 rounded border ${
              isCritical
                ? 'border-rose-800 bg-rose-950/40'
                : 'border-amber-800 bg-amber-950/30'
            }`}
          >
            <div
              className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded font-bold ${
                isCritical
                  ? 'bg-rose-500 text-rose-950'
                  : 'bg-amber-400 text-amber-950'
              }`}
            >
              {a.severity}
            </div>
            <div className="text-sm text-zinc-200 flex-1">{a.message}</div>
          </div>
        );
      })}
    </div>
  );
}
