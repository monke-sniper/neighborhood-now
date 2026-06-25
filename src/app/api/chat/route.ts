import { NextResponse } from 'next/server';
import { readOllamaHeaders, postOllamaChat } from '@/lib/llm/ollama';
import { buildChatContext } from '@/lib/prompts/chat';
import { log } from '@/lib/logger';
import type {
  ChatRequest,
  ChatResponse,
} from '@/lib/types';
import { isUpstreamError } from '@/lib/errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function POST(
  req: Request,
): Promise<NextResponse<ChatResponse | { error: string }>> {
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

  const cfg = readOllamaHeaders(req);
  if (!cfg.key) {
    return NextResponse.json({
      answer:
        'AI chat is not configured. Set OLLAMA_API_KEY in .env.local or in the Settings panel.',
      modelUsed: 'stub',
    });
  }

  try {
    const result = await postOllamaChat({
      base: cfg.base,
      key: cfg.key,
      model: cfg.model,
      messages: [
        { role: 'system', content: buildChatContext(body.report) },
        { role: 'user', content: body.question },
      ],
    });
    const answer = result.content.trim() || 'No response from model.';
    return NextResponse.json({ answer, modelUsed: result.modelUsed });
  } catch (err) {
    const msg =
      isUpstreamError(err) && err.status === 401
        ? 'AI provider rejected the API key. Check Settings.'
        : isUpstreamError(err)
          ? `AI provider error (${err.status ?? 'network'}). Please try again.`
          : 'AI request failed';
    log.warn('chat.failed', {
      source: isUpstreamError(err) ? err.source : 'unknown',
      status: isUpstreamError(err) ? err.status : null,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ answer: msg, modelUsed: cfg.model });
  }
}
