import { SCENARIOS } from '../engine/whatif';
import type { NeighborhoodReport } from '../types';

export const SYSTEM_PROMPT = `You are an urban planning assistant. Given a neighborhood report, recommend 2 to 3 specific interventions that would most improve livability.

Each recommendation must reference a real scenario from the list below and include a short title, a one-sentence reasoning, and a numeric expectedDelta (the score points you expect it to add).

AVAILABLE SCENARIOS (use exactly one of these scenarioId values):
${SCENARIOS.map((s) => `- ${s.id}: ${s.name} — ${s.description}`).join('\n')}

Respond with ONLY a JSON object in this exact shape, no prose, no markdown fences:
{"recommendations":[{"id":"rec-1","title":"...","reasoning":"...","scenarioId":"subway","expectedDelta":12}]}

Rules:
- id must be unique ("rec-1", "rec-2", "rec-3")
- title ≤ 60 chars, lowercase imperative ("build a school", "add a subway")
- reasoning ≤ 140 chars, reference a specific weakness in the report
- scenarioId must be one of the exact strings from the list above
- expectedDelta is your best guess at the total-score delta, integer 0-25
- Order by expected impact descending`;

export const IDEAS_PROMPT = `You are a creative urban strategist brainstorming unconventional, high-leverage ideas for a specific neighborhood based on its data report.

Given the neighborhood report, generate 3 to 4 creative, non-obvious ideas that go BEYOND the standard scenarios (no new subway, park, grocery, school, development, transit strike). Think:

- Tactical urbanism experiments (e.g. "parking-to-parklet conversions on side streets")
- Programming activations (e.g. "monthly night market", "outdoor library")
- Local economy initiatives (e.g. "BIPOC-owned business incubator", "tool library")
- Mobility hacks (e.g. "free e-bike share pilot", "school-bus-as-public-transit program")
- Public realm micro-interventions (e.g. "murals on blank walls", "tactical crosswalks")

Each idea should be 1-2 sentences, specific to the neighborhood's data (e.g. if greenSpace is low, don't suggest another park), and end with a one-line expected impact.

Format your response as plain prose with bullet points (use • for bullets, no JSON, no markdown headers). Keep it under 200 words total.`;

export function buildRecommendContext(report: NeighborhoodReport): string {
  const topComponents = Object.entries(report.score.breakdown)
    .map(([k, v]) => ({ k, v }))
    .sort((a, b) => a.v - b.v)
    .slice(0, 2)
    .map((c) => `${c.k}=${c.v}`)
    .join(', ');
  return JSON.stringify(
    {
      address: report.address,
      score: report.score.total,
      maxPossible: report.score.maxPossible,
      ranking: report.score.ranking.label,
      weakestComponents: topComponents,
      breakdown: report.score.breakdown,
      counts: {
        restaurants: report.amenities.amenities.filter((a) => a.kind === 'restaurant').length,
        cafes: report.amenities.amenities.filter((a) => a.kind === 'cafe').length,
        schools: report.amenities.amenities.filter((a) => a.kind === 'school').length,
        groceries: report.amenities.amenities.filter((a) => a.kind === 'grocery').length,
        parks: report.amenities.amenities.filter((a) => a.kind === 'park').length,
      },
      anomalies: report.anomalies.slice(0, 3).map((a) => ({
        signal: a.signal,
        severity: a.severity,
        message: a.message,
      })),
    },
    null,
    2,
  );
}

export function fallbackThinking(
  prompt: string,
  fallbackReason: string,
  modelUsed: string,
): { prompt: string; raw: string; modelUsed: string } {
  return {
    prompt,
    raw: `[ AI FALLBACK ] ${fallbackReason}\n\nThe recommendations below were generated deterministically from the weakest score components — no model was called.`,
    modelUsed,
  };
}

export function fallbackIdeas(reason: string): string {
  return `• [ IDEA FALLBACK ] AI creative-idea generation is unavailable (${reason}). Try: (1) walk the neighborhood and photograph blank walls for a mural pilot, (2) ask 5 local businesses what they need most, (3) run a one-day parking-to-parklet on a low-traffic side street.`;
}
