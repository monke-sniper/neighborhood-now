import { NextResponse } from 'next/server';
import { forecastTrend } from '@/lib/engine/forecast';
import type { Trend } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Body {
  series?: { name: string; history: number[] }[];
}

export async function POST(req: Request): Promise<NextResponse<Trend[] | { error: string }>> {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!Array.isArray(body.series)) {
    return NextResponse.json({ error: 'series[] required' }, { status: 400 });
  }
  const out = body.series.map((s) =>
    forecastTrend(Array.isArray(s.history) ? s.history : [], s.name),
  );
  return NextResponse.json(out);
}
