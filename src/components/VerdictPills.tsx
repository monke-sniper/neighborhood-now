import type { Verdict } from '@/lib/engine/verdict';

interface Props {
  verdicts: Verdict[];
}

function pillColor(key: Verdict['key']): string {
  switch (key) {
    case 'gentrification':
    case 'transit_desert':
    case 'food_desert':
    case 'park_poor':
      return 'border-[var(--color-warn)] text-[var(--color-warn)] bg-[#1a1303]';
    case 'transit_rich':
    case 'food_abundant':
    case 'green_oasis':
    case 'civic_strong':
    case 'service_strong':
    case 'amenity_thick':
    case 'quiet_block':
      return 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[#0a1a17]';
    default:
      return 'border-[var(--color-border)] text-[var(--color-text-dim)]';
  }
}

export function VerdictPills({ verdicts }: Props) {
  if (verdicts.length === 0) {
    return (
      <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-mute)] uppercase tracking-widest border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <span className="text-[var(--color-text-dim)]">[ NO VERDICT ]</span>
        <span>Every signal is within ±1σ of the citywide baseline.</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
        <h3 className="text-xs uppercase tracking-widest text-[var(--color-accent)] font-semibold">
          [ VERDICT // PLAIN-LANGUAGE READ ]
        </h3>
        <span className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider">
          {verdicts.length} FLAG{verdicts.length === 1 ? '' : 'S'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {verdicts.map((v) => (
          <span
            key={v.key}
            className={`text-[10px] font-bold uppercase tracking-widest border px-2 py-1 ${pillColor(v.key)}`}
            title={v.reason}
          >
            [{v.emoji}] {v.label}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-[var(--color-text-mute)] leading-relaxed uppercase tracking-wider pt-2 border-t border-[var(--color-border)]">
        {verdicts[0]!.reason}
      </p>
    </div>
  );
}
