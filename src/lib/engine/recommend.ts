import { SCENARIOS, scenarioDelta } from './whatif';
import type {
  NeighborhoodReport,
  Recommendation,
  ScoreBreakdown,
} from '../types';

export function extractJson(text: string): unknown | null {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  const candidate = fenceMatch ? fenceMatch[1]! : text;
  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function sanitizeRecs(parsed: unknown): Recommendation[] {
  if (!parsed || typeof parsed !== 'object') return [];
  const obj = parsed as { recommendations?: unknown };
  if (!Array.isArray(obj.recommendations)) return [];
  const validIds = new Set(SCENARIOS.map((s) => s.id));
  const out: Recommendation[] = [];
  for (let i = 0; i < obj.recommendations.length && out.length < 3; i++) {
    const raw = obj.recommendations[i] as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object') continue;
    const scenarioId = typeof raw.scenarioId === 'string' ? raw.scenarioId : '';
    if (!validIds.has(scenarioId)) continue;
    const title = typeof raw.title === 'string' ? raw.title.slice(0, 80) : '';
    const reasoning = typeof raw.reasoning === 'string' ? raw.reasoning.slice(0, 200) : '';
    const expectedDelta = Number.isFinite(raw.expectedDelta)
      ? Math.max(0, Math.min(25, Math.round(Number(raw.expectedDelta))))
      : 0;
    const id = typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : `rec-${out.length + 1}`;
    if (!title || !reasoning) continue;
    out.push({ id, title, reasoning, scenarioId, expectedDelta });
  }
  return out;
}

const SCENARIO_FOR_COMPONENT: Record<keyof ScoreBreakdown, string> = {
  transitScore: 'subway',
  greenSpace: 'park',
  foodAccess: 'grocery',
  amenityDensity: 'development',
  development: 'development',
  civicScore: 'development',
  cultureScore: 'development',
  recreationScore: 'park',
  serviceScore: 'development',
};

const COMPONENT_LABEL: Record<keyof ScoreBreakdown, string> = {
  amenityDensity: 'amenity density',
  transitScore: 'transit',
  foodAccess: 'food access',
  greenSpace: 'green space',
  development: 'development activity',
  civicScore: 'civic services',
  cultureScore: 'cultural venues',
  recreationScore: 'recreation',
  serviceScore: 'service amenities',
};

export function fallbackRecs(report: NeighborhoodReport): Recommendation[] {
  const breakdown = report.score.breakdown;
  const sorted = (Object.keys(breakdown) as (keyof ScoreBreakdown)[])
    .sort((a, b) => breakdown[a] - breakdown[b]);
  const weakest = sorted.slice(0, 2);
  const out: Recommendation[] = [];
  const used = new Set<string>();
  for (const key of weakest) {
    const scenarioId = SCENARIO_FOR_COMPONENT[key];
    if (!scenarioId || used.has(scenarioId)) continue;
    used.add(scenarioId);
    const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
    const delta = scenarioDelta(breakdown, scenarioId);
    out.push({
      id: `rec-${out.length + 1}`,
      title: `Build a ${scenario.name.toLowerCase()}`,
      reasoning: `${COMPONENT_LABEL[key]} is the weakest component at ${breakdown[key]}/100. ${scenario.name} would lift it by ${delta} pts.`,
      scenarioId,
      expectedDelta: delta,
    });
  }
  return out.slice(0, 3);
}
