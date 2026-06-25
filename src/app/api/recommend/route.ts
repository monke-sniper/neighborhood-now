import { NextResponse } from 'next/server';
import { extractJson, fallbackRecs, sanitizeRecs } from '@/lib/engine/recommend';
import {
  SYSTEM_PROMPT,
  IDEAS_PROMPT,
  buildRecommendContext,
  fallbackThinking,
  fallbackIdeas,
} from '@/lib/prompts/recommend';
import { readOllamaHeaders, postOllamaChat } from '@/lib/llm/ollama';
import { log } from '@/lib/logger';
import type {
  RecommendationRequest,
  RecommendationResponse,
  RecommendationThinking,
} from '@/lib/types';
import { isUpstreamError } from '@/lib/errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

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

  const cfg = readOllamaHeaders(req);
  const fallback = fallbackRecs(body.report);
  const userMessage = `NEIGHBORHOOD REPORT:\n${buildRecommendContext(body.report)}`;

  if (!cfg.key) {
    return NextResponse.json({
      recommendations: fallback,
      thinking: fallbackThinking(userMessage, 'no Ollama API key configured', 'fallback'),
      ideas: fallbackIdeas('no Ollama API key configured'),
      modelUsed: 'fallback',
    });
  }

  const [recsRes, ideasRes] = await Promise.allSettled([
    postOllamaChat({
      base: cfg.base,
      key: cfg.key,
      model: cfg.model,
      format: 'json',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    }),
    postOllamaChat({
      base: cfg.base,
      key: cfg.key,
      model: cfg.model,
      messages: [
        { role: 'system', content: IDEAS_PROMPT },
        { role: 'user', content: userMessage },
      ],
    }),
  ]);

  const recsRaw = recsRes.status === 'fulfilled' ? recsRes.value.content : null;
  const ideasRaw = ideasRes.status === 'fulfilled' ? ideasRes.value.content : null;

  if (recsRes.status === 'rejected') {
    log.warn('recommend.recs_failed', {
      error: isUpstreamError(recsRes.reason)
        ? recsRes.reason.message
        : String(recsRes.reason),
    });
  }
  if (ideasRes.status === 'rejected') {
    log.warn('recommend.ideas_failed', {
      error: isUpstreamError(ideasRes.reason)
        ? ideasRes.reason.message
        : String(ideasRes.reason),
    });
  }

  const thinking: RecommendationThinking = {
    prompt: userMessage,
    raw:
      recsRaw ??
      `[ AI CALL FAILED ] The recommendation model call returned no content. Falling back to deterministic ranking.`,
    modelUsed: cfg.model,
  };

  let recommendations = fallback;
  if (recsRaw) {
    const parsed = extractJson(recsRaw);
    const cleaned = sanitizeRecs(parsed);
    if (cleaned.length > 0) recommendations = cleaned;
  }

  const ideas = ideasRaw ?? fallbackIdeas('creative-idea call returned no content');

  return NextResponse.json({
    recommendations,
    thinking,
    ideas,
    modelUsed: cfg.model,
  });
}
