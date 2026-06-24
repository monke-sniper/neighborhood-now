import { NextResponse } from 'next/server';
import type { ChatRequest, ChatResponse, NeighborhoodReport } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'https://ollama.com';
const OLLAMA_KEY = process.env.OLLAMA_API_KEY || '';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:20b';

function systemPrompt(report: NeighborhoodReport): string {
  const safe = JSON.stringify(
    {
      address: report.address,
      score: report.score,
      amenities: {
        count: report.amenities.amenities.length,
        transit: report.amenities.transit.length,
        buildings: report.amenities.buildings.length,
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

  if (!OLLAMA_KEY) {
    return NextResponse.json({
      answer:
        'AI chat is not configured. Set OLLAMA_API_KEY in .env.local to enable.',
      modelUsed: 'stub',
    });
  }

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OLLAMA_KEY}`,
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
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
        modelUsed: OLLAMA_MODEL,
      });
    }

    const data = (await res.json()) as {
      message?: { content?: string };
    };
    const answer = data.message?.content?.trim() || 'No response from model.';
    return NextResponse.json({ answer, modelUsed: OLLAMA_MODEL });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI request failed';
    return NextResponse.json({ answer: message, modelUsed: OLLAMA_MODEL });
  }
}
