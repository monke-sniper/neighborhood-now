import { NextResponse } from 'next/server';
import type {
  Amenity,
  AmenityKind,
  ChatRequest,
  ChatResponse,
  NeighborhoodReport,
} from '@/lib/types';
import { haversineMeters } from '@/lib/utils/geo';
import { pickName } from '@/lib/utils/amenity';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const DEFAULT_OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'https://ollama.com';
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:20b';
const SERVER_OLLAMA_KEY = process.env.OLLAMA_API_KEY || '';

const NAMED_PER_KIND: Partial<Record<AmenityKind, number>> = {
  restaurant: 10,
  school: 5,
  grocery: 5,
  park: 5,
  cafe: 5,
  civic: 5,
  culture: 5,
  recreation: 5,
  service: 5,
  construction: 3,
};

function pickDisplayName(a: Amenity): string | null {
  const t = a.tags ?? {};
  if (t.name ?? t['name:en'] ?? t.brand ?? t.operator) {
    return pickName(a);
  }
  return null;
}

function namedByKind(
  amenities: Amenity[],
  center: NeighborhoodReport['coords'],
): Record<string, Array<{ name: string; kind: AmenityKind; distanceKm: number }>> {
  const grouped = new Map<AmenityKind, Amenity[]>();
  for (const a of amenities) {
    const name = pickDisplayName(a);
    if (!name) continue;
    const arr = grouped.get(a.kind) ?? [];
    arr.push(a);
    grouped.set(a.kind, arr);
  }
  const out: Record<string, Array<{ name: string; kind: AmenityKind; distanceKm: number }>> = {};
  for (const [kind, items] of grouped) {
    const limit = NAMED_PER_KIND[kind] ?? 5;
    items.sort(
      (a, b) => haversineMeters(a, center) - haversineMeters(b, center),
    );
    out[kind] = items.slice(0, limit).map((a) => ({
      name: pickDisplayName(a)!,
      kind,
      distanceKm: Number((haversineMeters(a, center) / 1000).toFixed(2)),
    }));
  }
  return out;
}

function systemPrompt(report: NeighborhoodReport): string {
  const safe = JSON.stringify(
    {
      address: report.address,
      score: report.score,
      amenities: {
        count: report.amenities.amenities.length,
        transit: report.amenities.transit.length,
        buildings: report.amenities.buildings.length,
        named: namedByKind(report.amenities.amenities, report.coords),
      },
      permits: report.permits.length,
      recentPermits: report.permits.slice(0, 5).map((p) => ({
        address: p.address,
        description: p.description,
        issuedDate: p.issuedDate,
      })),
      complaints: report.complaints.length,
      recentComplaints: report.complaints.slice(0, 5).map((c) => ({
        type: c.type,
        date: c.date,
        status: c.status,
      })),
      anomalies: report.anomalies,
      trends: report.trends,
    },
    null,
    2,
  );
  return (
    'You are a neighborhood intelligence assistant. Answer the user\'s question ' +
    'using ONLY the data provided below. If the data does not contain enough ' +
    'information to answer, say so. Never invent numbers or claims. Keep ' +
    'answers under 120 words.\n\nNEIGHBORHOOD DATA:\n' +
    safe
  );
}

export async function POST(req: Request): Promise<NextResponse<ChatResponse | { error: string }>> {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body?.question || !body?.report) {
    return NextResponse.json(
      { error: 'question + report required' },
      { status: 400 },
    );
  }

  const ollamaKey = req.headers.get('X-Ollama-Key') ?? SERVER_OLLAMA_KEY;
  const ollamaBase = req.headers.get('X-Ollama-Base') ?? DEFAULT_OLLAMA_BASE;
  const ollamaModel = req.headers.get('X-Ollama-Model') ?? DEFAULT_OLLAMA_MODEL;

  if (!ollamaKey) {
    return NextResponse.json({
      answer:
        'AI chat is not configured. Set OLLAMA_API_KEY in .env.local or in the Settings panel.',
      modelUsed: 'stub',
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
        messages: [
          { role: 'system', content: systemPrompt(body.report) },
          { role: 'user', content: body.question },
        ],
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({
        answer: `AI provider error (${res.status}). Please try again.`,
        modelUsed: ollamaModel,
      });
    }

    const data = (await res.json()) as {
      message?: { content?: string };
    };
    const answer = data.message?.content?.trim() || 'No response from model.';
    return NextResponse.json({ answer, modelUsed: ollamaModel });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI request failed';
    return NextResponse.json({ answer: message, modelUsed: ollamaModel });
  }
}
