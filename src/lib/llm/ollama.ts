import { httpJson } from '../http';
import { log } from '../logger';
import { UpstreamError } from '../errors';

const DEFAULT_OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'https://ollama.com';
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:20b';
const SERVER_OLLAMA_KEY = process.env.OLLAMA_API_KEY || '';

export interface OllamaConfig {
  base: string;
  model: string;
  key: string;
}

export function readOllamaHeaders(req: Request): OllamaConfig {
  return {
    base: req.headers.get('X-Ollama-Base') ?? DEFAULT_OLLAMA_BASE,
    model: req.headers.get('X-Ollama-Model') ?? DEFAULT_OLLAMA_MODEL,
    key: req.headers.get('X-Ollama-Key') ?? SERVER_OLLAMA_KEY,
  };
}

export function getOllamaConfig(): OllamaConfig {
  return {
    base: DEFAULT_OLLAMA_BASE,
    model: DEFAULT_OLLAMA_MODEL,
    key: SERVER_OLLAMA_KEY,
  };
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatOptions {
  base?: string;
  model?: string;
  key?: string;
  format?: 'json';
  messages: OllamaChatMessage[];
  timeoutMs?: number;
}

export interface OllamaChatResult {
  content: string;
  modelUsed: string;
}

export async function postOllamaChat(
  opts: OllamaChatOptions,
): Promise<OllamaChatResult> {
  const base = opts.base ?? DEFAULT_OLLAMA_BASE;
  const model = opts.model ?? DEFAULT_OLLAMA_MODEL;
  if (!opts.key) {
    throw new UpstreamError('ollama', 'No Ollama API key configured', {
      status: 401,
    });
  }
  const body: Record<string, unknown> = {
    model,
    stream: false,
    messages: opts.messages,
  };
  if (opts.format) body.format = opts.format;
  const data = await httpJson<{ message?: { content?: string } }>(
    `${base}/api/chat`,
    {
      method: 'POST',
      source: 'ollama',
      headers: { Authorization: `Bearer ${opts.key}` },
      body,
      timeoutMs: opts.timeoutMs ?? 25_000,
    },
  );
  const content = data.message?.content ?? '';
  log.debug('ollama.chat.ok', { model, contentLength: content.length });
  return { content, modelUsed: model };
}
