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
import { getBenchmarkTemplate } from '@/lib/engine/forecast';

interface Props {
  trends: Trend[];
}

interface Row {
  month: string;
  isForecast: boolean;
  isTemplate?: boolean;
  [signal: string]: number | boolean | string | undefined;
}

const HISTORY_LABELS = Array.from({ length: 12 }, (_, i) => {
  const offset = i - 11;
  return offset === 0 ? 'NOW' : `${offset}m`;
});

const COLORS = ['#5eead4', '#fbbf24', '#a78bfa'];

export function ForecastChart({ trends }: Props) {
  const { data, isTemplate, templateNote, primary } = useMemo(() => {
    const n = 12;
    const out: Row[] = [];
    let template = false;
    let note = '';
    let primaryTrend: Trend | null = null;

    if (trends.length > 0) {
      primaryTrend = trends[0]!;
      const tpl = getBenchmarkTemplate(primaryTrend.signal);
      const useTemplate =
        primaryTrend.history.every((v) => v === 0) &&
        primaryTrend.forecast6m === 0;
      template = useTemplate;
      note = tpl.note;

      for (let i = 0; i < n; i++) {
        const row: Row = {
          month: HISTORY_LABELS[i]!,
          isForecast: false,
          isTemplate: useTemplate,
        };
        const v = useTemplate
          ? (tpl.history[i] ?? 0)
          : primaryTrend.history?.[i] ?? 0;
        row[primaryTrend.signal] = v;
        out.push(row);
      }

      const last = primaryTrend.history?.[n - 1] ?? 0;
      const f6 = useTemplate
        ? tpl.history[n - 1]! * 1.1
        : primaryTrend.forecast6m;
      const f12 = useTemplate
        ? tpl.history[n - 1]! * 1.2
        : primaryTrend.forecast12m;
      const f24 = useTemplate
        ? tpl.history[n - 1]! * 1.3
        : primaryTrend.forecast24m;
      void last;

      out.push(
        {
          month: '+6m',
          isForecast: true,
          isTemplate: useTemplate,
          [primaryTrend.signal]: Math.round(f6),
        },
        {
          month: '+12m',
          isForecast: true,
          isTemplate: useTemplate,
          [primaryTrend.signal]: Math.round(f12),
        },
        {
          month: '+24m',
          isForecast: true,
          isTemplate: useTemplate,
          [primaryTrend.signal]: Math.round(f24),
        },
      );
    } else {
      for (let i = 0; i < n; i++) {
        out.push({
          month: HISTORY_LABELS[i]!,
          isForecast: false,
        });
      }
    }
    return {
      data: out,
      isTemplate: template,
      templateNote: note,
      primary: primaryTrend,
    };
  }, [trends]);

  if (trends.length === 0 || !primary) {
    return (
      <div className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-text-mute)] uppercase tracking-wider">
        [ INSUFFICIENT HISTORY // NEED AT LEAST 3 MONTHS OF DATA ]
      </div>
    );
  }

  const showSecondary = Boolean(trends[1]);
  const lowKey = `${primary.signal}__low`;
  const highKey = `${primary.signal}__high`;
  const methodLabel = isTemplate
    ? 'TEMPLATE'
    : primary.method?.toUpperCase() ?? 'FLAT';

  return (
    <div className="flex flex-col gap-2 p-4 border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
        <h2 className="text-xs uppercase tracking-widest text-[var(--color-accent)] font-semibold">
          [ 2-YEAR FORECAST // 12M HISTORY + 24M PROJECTION
          {isTemplate ? ' // TEMPLATE' : ''} ]
        </h2>
        <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider">
          METHOD: {methodLabel}
          {!isTemplate && ` · R² ${primary.r2.toFixed(2)}`}
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
            {!isTemplate && (
              <>
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
              </>
            )}
            <Bar
              dataKey={primary.signal}
              fill={COLORS[0]}
              fillOpacity={isTemplate ? 0.25 : 0.55}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey={primary.signal}
              stroke={COLORS[0]}
              strokeWidth={1.5}
              strokeDasharray={isTemplate ? '4 4' : undefined}
              dot={{ r: 3, fill: COLORS[0] }}
              connectNulls={false}
              isAnimationActive={false}
            />
            {showSecondary && (
              <Line
                type="monotone"
                dataKey={trends[1]!.signal}
                stroke={COLORS[1]}
                strokeWidth={1.5}
                dot={{ r: 3, fill: COLORS[1] }}
                connectNulls={false}
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
      <div className="text-[10px] text-[var(--color-text-mute)] flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t border-[var(--color-border)] uppercase tracking-wider leading-relaxed">
        {isTemplate ? (
          <>
            <span>[ DASHED ] TEMPLATE PROJECTION</span>
            <span className="text-[var(--color-text-mute)]">·</span>
            <span>{templateNote}</span>
          </>
        ) : (
          <>
            <span>[ BARS ] HISTORY</span>
            <span className="text-[var(--color-text-mute)]">·</span>
            <span>[ LINE ] PROJECTION</span>
            <span className="text-[var(--color-text-mute)]">·</span>
            <span>[ SHADE ] 1σ BAND</span>
            <span className="text-[var(--color-text-mute)]">·</span>
            <span>CONFIDENCE: {primary.confidence.toUpperCase()}</span>
          </>
        )}
      </div>
    </div>
  );
}
