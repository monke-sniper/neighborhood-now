'use client';

import { ALLOWED_RADII_M } from '@/lib/config';

interface Props {
  value: number;
  onChange: (radius: number) => void;
  disabled?: boolean;
}

function label(m: number): string {
  return m >= 1000 ? `${m / 1000}KM` : `${m}M`;
}

export function RadiusSelect({ value, onChange, disabled }: Props) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-mute)] mr-1">
        RADIUS
      </span>
      {ALLOWED_RADII_M.map((r) => {
        const on = r === value;
        return (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            disabled={disabled}
            className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 border ${
              on
                ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[#0a1a17]'
                : 'border-[var(--color-border-strong)] text-[var(--color-text-mute)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
            } disabled:opacity-50`}
            aria-pressed={on}
          >
            [ {label(r)} ]
          </button>
        );
      })}
    </div>
  );
}
