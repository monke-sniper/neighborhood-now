'use client';

import { useMemo } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Trend } from '@/lib/types';

interface Props {
  trends: Trend[];
}

interface Row {
  month: string;
  isForecast: boolean;
  [signal: string]: number | string | boolean;
}

const HISTORY_LABELS = Array.from({ length: 12 }, (_, i) => {
  const offset = i - 11;
  return offset === 0 ? 'NOW' : `${offset}m`;
});

const FORECAST_LABELS = ['+6m', '+12m', '+24m'];
const COLORS = ['#5eead4', '#fbbf24', '#a78bfa'];

function clamp01(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function ForecastChart({ trends }: Props) {
  const data = useMemo<Row[]>(() => {
    const n = 12;
    const out: Row[] = [];
    for (let i = 0; i < n; i++) {
      const row: Row = {
        month: HISTORY_LABELS[i]!,
        isForecast: false,
      };
      for (const t of trends) {
        const v = t.history?.[i] ?? 0;
        row[t.signal] = v;
      }
      out.push(row);
    }
    if (trends.length > 0) {
      const last = trends[0]!;
      const f6 = last.forecast6m;
      const f12 = last.forecast12m;
      const f24 = last.forecast24m;
      const b6 = last.band?.forecast6m;
      const b12 = last.band?.forecast12m;
      const b24 = last.band?.forecast24m;
      out.push(
        {
          month: '+6m',
          isForecast: true,
          [trends[0].signal]: f6,
          ...(b6 ? { [`${trends[0].signal}__low`]: b6.low, [`${trends[0].signal}__high`]: b6.high } : {}),
        },
        {
          month: '+12m',
          isForecast: true,
          [trends[0].signal]: f12,
          ...(b12 ? { [`${trends[0].signal}__low`]: b12.low, [`${trends[0].signal}__high`]: b12.high } : {}),
        },
        {
          month: '+24m',
          isForecast: true,
          [trends[0].signal]: f24,
          ...(b24 ? { [`${trends[0].signal}__low`]: b24.low, [`${trends[0].signal}__high`]: b24.high } : {}),
        },
      );
    }
    return out;
  }, [trends]);

  if (trends.length === 0) {
    return (
      <div className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-text-mute)] uppercase tracking-wider">
        [ INSUFFICIENT HISTORY // NEED AT LEAST 3 MONTHS OF DATA ]
      </div>
    );
  }

  const allZero = trends.every(
    (t) => t.history.every((v) => v === 0) && t.forecast6m === 0,
  );
  if (allZero) {
    return (
      <div className="flex flex-col gap-2 p-4 border border-[var(--color-border)] bg-[var(--color-surface)]">
        <h2 className="text-xs uppercase tracking-widest text-[var(--color-accent)] font-semibold border-b border-[var(--color-border)] pb-2">
          [ 2-YEAR FORECAST ]
        </h2>
        <div className="text-xs text-[var(--color-text-mute)] uppercase tracking-wider py-6 text-center">
          [ NO HISTORICAL ACTIVITY // CANNOT FORECAST TRENDLESS DATA ]
        </div>
      </div>
    );
  }

  const primary = trends[0]!;
  const secondary = trends[1];
  const showSecondary = Boolean(secondary);
  const lowKey = `${primary.signal}__low`;
  const highKey = `${primary.signal}__high`;

  return (
    <div className="flex flex-col gap-2 p-4 border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
        <h2 className="text-xs uppercase tracking-widest text-[var(--color-accent)] font-semibold">
          [ 2-YEAR FORECAST // 12M HISTORY + 24M PROJECTION ]
        </h2>
        <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider">
          METHOD: {primary.method?.toUpperCase() ?? 'FLAT'} · R² {primary.r2.toFixed(2)}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
          >
            <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
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
            <ReferenceLine
              x="NOW"
              stroke="#5eead4"
              strokeDasharray="3 3"
              label={{
                value: '| FORECAST |',
                position: 'top',
                fill: '#5eead4',
                fontSize: 9,
                fontFamily: 'var(--font-mono)',
              }}
            />
            <Area
              type="monotone"
              dataKey={highKey}
              stroke="none"
              fill="#5eead4"
              fillOpacity={0.08}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Area
              type="monotone"
              dataKey={lowKey}
              stroke="none"
              fill="#000000"
              fillOpacity={1}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Bar
              dataKey={primary.signal}
              fill={COLORS[0]}
              fillOpacity={0.55}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey={primary.signal}
              stroke={COLORS[0]}
              strokeWidth={1.5}
              dot={{ r: 3, fill: COLORS[0] }}
              connectNulls={false}
              isAnimationActive={false}
            />
            {showSecondary && (
              <Line
                type="monotone"
                dataKey={secondary!.signal}
                stroke={COLORS[1]}
                strokeWidth={1.5}
                dot={{ r: 3, fill: COLORS[1] }}
                isAnimationActive={false}
              />
            )}
            <Legend
              wrapperStyle={{
                fontSize: 10,
                color: '#888',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-mono)',
                paddingTop: 4,
              }}
              iconType="plainline"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="text-[10px] text-[var(--color-text-mute)] flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t border-[var(--color-border)] uppercase tracking-wider">
        <span>[ BARS ] HISTORY</span>
        <span className="text-[var(--color-text-mute)]">·</span>
        <span>[ LINE ] PROJECTION</span>
        <span className="text-[var(--color-text-mute)]">·</span>
        <span>[ SHADE ] 1σ BAND</span>
        <span className="text-[var(--color-text-mute)]">·</span>
        <span>CONFIDENCE: {primary.confidence.toUpperCase()}</span>
      </div>
    </div>
  );
}
