import { NextResponse } from 'next/server';
import { detectAnomalies } from '@/lib/engine/anomalies';
import type { Anomaly, Signal } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Body {
  signals?: Signal[];
}

export async function POST(req: Request): Promise<NextResponse<Anomaly[] | { error: string }>> {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!Array.isArray(body.signals)) {
    return NextResponse.json({ error: 'signals[] required' }, { status: 400 });
  }
  return NextResponse.json(detectAnomalies(body.signals));
}
