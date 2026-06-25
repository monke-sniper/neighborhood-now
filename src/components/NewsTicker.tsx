import type { Anomaly } from '@/lib/types';

interface Props {
  anomalies: Anomaly[];
  address: string;
}

function headline(a: Anomaly, address: string): string {
  const place = address.split(',')[0] ?? address;
  const dir = a.zscore > 0 ? 'ABOVE' : 'BELOW';
  const severity = a.severity === 'critical' ? 'BREAKING' : 'NOTEWORTHY';
  return `[ ${severity} ] ${a.signal.toUpperCase()} ${dir} BASELINE (${a.zscore.toFixed(1)}σ) NEAR ${place.toUpperCase()}`;
}

function timestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function NewsTicker({ anomalies, address }: Props) {
  const now = new Date();
  const ts = timestamp(now);
  const top = anomalies
    .filter((a) => Math.abs(a.zscore) > 1.5)
    .slice(0, 4);

  const items: string[] = [];
  items.push(
    `[ ${ts} ] LIVE NEIGHBORHOOD INTEL // ADDRESS RESOLVED // ${anomalies.length} ANOMALY SIGNAL${anomalies.length === 1 ? '' : 'S'} DETECTED`,
  );
  for (const a of top) {
    items.push(headline(a, address));
  }
  if (top.length === 0) {
    items.push(`[ ${ts} ] ALL SIGNALS WITHIN ±1.5σ — STABLE NEIGHBORHOOD`);
  }
  items.push(
    `[ NN // 9-COMPONENT LIVABILITY · 4 SIGNAL STREAMS · 2-YEAR FORECAST · WHAT-IF ENGINE ]`,
  );

  const text = items.join('   ·   ');

  return (
    <div className="flex items-center gap-2 border border-[var(--color-accent)] bg-[#0a1a17] overflow-hidden">
      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-black bg-[var(--color-accent)] whitespace-nowrap">
        [ JUST IN ]
      </div>
      <div className="flex-1 overflow-hidden relative h-7">
        <div
          className="absolute whitespace-nowrap text-[10px] uppercase tracking-widest text-[var(--color-accent)] font-mono"
          style={{
            top: '50%',
            transform: 'translateY(-50%)',
            animation: `nn-ticker-scroll ${Math.max(20, text.length * 0.18)}s linear infinite`,
          }}
        >
          {text}
        </div>
        <style>{`@keyframes nn-ticker-scroll { from { left: 100%; } to { left: -100%; } }`}</style>
      </div>
    </div>
  );
}
