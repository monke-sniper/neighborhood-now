import { NextResponse } from 'next/server';
import { detectAnomalies, type AnomalyContext } from '@/lib/engine/anomalies';
import type { Anomaly } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
): Promise<NextResponse<Anomaly[] | { error: string }>> {
  let body: Partial<AnomalyContext>;
  try {
    body = (await req.json()) as Partial<AnomalyContext>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (
    !body ||
    !body.scoreBreakdown ||
    !body.amenityCounts ||
    typeof body.permitsLast30d !== 'number' ||
    typeof body.permitsLast6m !== 'number' ||
    typeof body.complaintsLast30d !== 'number' ||
    typeof body.complaintsLast90d !== 'number'
  ) {
    return NextResponse.json(
      {
        error:
          'Requires { permitsLast30d, permitsLast6m, complaintsLast30d, complaintsLast90d, amenityCounts, scoreBreakdown, airQuality?, census? }',
      },
      { status: 400 },
    );
  }
  return NextResponse.json(detectAnomalies(body as AnomalyContext));
}
