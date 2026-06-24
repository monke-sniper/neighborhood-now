'use client';

import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Trend } from '@/lib/types';

interface Props {
  trends: Trend[];
}

const HORIZONS: Array<{ key: 'current' | 'forecast6m' | 'forecast12m' | 'forecast24m'; label: string }> = [
  { key: 'current', label: 'now' },
  { key: 'forecast6m', label: '+6m' },
  { key: 'forecast12m', label: '+12m' },
  { key: 'forecast24m', label: '+24m' },
];

const COLORS = ['#5eead4', '#fbbf24', '#a78bfa', '#f472b6', '#34d399'];

export function ForecastChart({ trends }: Props) {
  const data = useMemo(() => {
    if (trends.length === 0) return [] as Array<Record<string, number | string>>;
    return HORIZONS.map((h) => {
      const row: Record<string, number | string> = { horizon: h.label };
      for (const t of trends) {
        row[t.signal] = Number((t[h.key] ?? 0).toFixed(2));
      }
      return row;
    });
  }, [trends]);

  if (trends.length === 0) {
    return (
      <div className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-text-mute)] uppercase tracking-wider">
        [ INSUFFICIENT HISTORY // NEED AT LEAST 3 MONTHS OF DATA ]
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4 border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
        <h2 className="text-xs uppercase tracking-widest text-[var(--color-accent)] font-semibold">
          [ 2-YEAR FORECAST ]
        </h2>
        <div className="flex flex-wrap gap-3 text-[10px] text-[var(--color-text-dim)] uppercase tracking-wider">
          {trends.map((t, i) => (
            <span key={t.signal} className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-0.5"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              {t.signal}
              <span className="text-[var(--color-text-mute)]">
                ({t.method ?? 'flat'} · {t.confidence})
              </span>
            </span>
          ))}
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" />
            <XAxis
              dataKey="horizon"
              stroke="#555"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#1f1f1f' }}
            />
            <YAxis
              stroke="#555"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#1f1f1f' }}
            />
            <Tooltip
              contentStyle={{
                background: '#000',
                border: '1px solid #5eead4',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
              }}
              labelStyle={{ color: '#5eead4', textTransform: 'uppercase' }}
              itemStyle={{ color: '#ededed' }}
            />
            {trends.map((t, i) => (
              <Line
                key={t.signal}
                type="monotone"
                dataKey={t.signal}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={1.5}
                dot={{ r: 2, fill: COLORS[i % COLORS.length] }}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
