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
      <div className="p-4 rounded border border-zinc-800 bg-zinc-900/50 text-sm text-zinc-500">
        Not enough history yet to forecast trends.
      </div>
    );
  }

  const colors = ['#10b981', '#f59e0b', '#60a5fa', '#a78bfa', '#f472b6'];

  return (
    <div className="flex flex-col gap-2 p-4 rounded border border-zinc-800 bg-zinc-900/50">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm uppercase tracking-widest text-zinc-400">
          2-year forecast
        </h2>
        <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
          {trends.map((t, i) => (
            <span key={t.signal} className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-1"
                style={{ background: colors[i % colors.length] }}
              />
              {t.signal}
              <span className="text-zinc-600">({t.confidence})</span>
            </span>
          ))}
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
            <XAxis dataKey="horizon" stroke="#71717a" fontSize={12} />
            <YAxis stroke="#71717a" fontSize={12} />
            <Tooltip
              contentStyle={{
                background: '#18181b',
                border: '1px solid #3f3f46',
                fontSize: 12,
              }}
              labelStyle={{ color: '#a1a1aa' }}
            />
            {trends.map((t, i) => (
              <Line
                key={t.signal}
                type="monotone"
                dataKey={t.signal}
                stroke={colors[i % colors.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
