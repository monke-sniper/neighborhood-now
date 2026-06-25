import { NextResponse } from 'next/server';
import { SCENARIOS } from '@/lib/engine/whatif';
import { extractJson, fallbackRecs, sanitizeRecs } from '@/lib/engine/recommend';
import type {
  RecommendationRequest,
  RecommendationResponse,
} from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'https://ollama.com';
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:20b';
const SERVER_OLLAMA_KEY = process.env.OLLAMA_API_KEY || '';

const SYSTEM_PROMPT = `You are an urban planning assistant. Given a neighborhood report, recommend 2 to 3 specific interventions that would most improve livability.

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

function buildContext(report: RecommendationRequest['report']): string {
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

export async function POST(
  req: Request,
): Promise<NextResponse<RecommendationResponse | { error: string }>> {
  let body: RecommendationRequest;
  try {
    body = (await req.json()) as RecommendationRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body?.report) {
    return NextResponse.json({ error: 'report required' }, { status: 400 });
  }

  const fallback = fallbackRecs(body.report);

  const ollamaKey = req.headers.get('X-Ollama-Key') ?? SERVER_OLLAMA_KEY;
  const ollamaBase = req.headers.get('X-Ollama-Base') ?? DEFAULT_OLLAMA_BASE;
  const ollamaModel = req.headers.get('X-Ollama-Model') ?? DEFAULT_OLLAMA_MODEL;

  if (!ollamaKey) {
    return NextResponse.json({
      recommendations: fallback,
      modelUsed: 'fallback',
    });
  }

  try {
    const res = await fetch(`${ollamaBase}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ollamaKey}`,
      },
      body: JSON.stringify({
        model: ollamaModel,
        stream: false,
        format: 'json',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `NEIGHBORHOOD REPORT:\n${buildContext(body.report)}` },
        ],
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({
        recommendations: fallback,
        modelUsed: ollamaModel,
      });
    }

    const data = (await res.json()) as { message?: { content?: string } };
    const raw = data.message?.content ?? '';
    const parsed = extractJson(raw);
    const cleaned = sanitizeRecs(parsed);
    return NextResponse.json({
      recommendations: cleaned.length > 0 ? cleaned : fallback,
      modelUsed: ollamaModel,
    });
  } catch {
    return NextResponse.json({
      recommendations: fallback,
      modelUsed: ollamaModel,
    });
  }
}
