import { NextResponse } from 'next/server';
import { SCENARIOS, simulateWhatIf } from '@/lib/engine/whatif';
import type { Scenario, ScenarioResult, ScoreBreakdown } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Body {
  current?: ScoreBreakdown;
  scenarioId?: string;
}

export async function POST(req: Request): Promise<NextResponse<ScenarioResult | { error: string }>> {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.current || !body.scenarioId) {
    return NextResponse.json(
      { error: 'current + scenarioId required' },
      { status: 400 },
    );
  }
  const scenario: Scenario | undefined = SCENARIOS.find(
    (s) => s.id === body.scenarioId,
  );
  if (!scenario) {
    return NextResponse.json({ error: 'Unknown scenario' }, { status: 400 });
  }
  return NextResponse.json(simulateWhatIf(body.current, scenario));
}
