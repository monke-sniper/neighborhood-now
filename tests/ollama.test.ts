import { describe, expect, it, vi } from 'vitest';
import { postOllamaChat, readOllamaHeaders, getOllamaConfig } from '@/lib/llm/ollama';
import { UpstreamError } from '@/lib/errors';

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
    headers: new Headers({ 'content-type': 'application/json' }),
  })) as unknown as typeof fetch;
}

describe('readOllamaHeaders', () => {
  it('reads from request headers with env fallbacks', () => {
    const req = new Request('http://localhost', {
      headers: {
        'X-Ollama-Key': 'sk-test',
        'X-Ollama-Base': 'http://localhost:11434',
        'X-Ollama-Model': 'llama3.2:3b',
      },
    });
    const cfg = readOllamaHeaders(req);
    expect(cfg.key).toBe('sk-test');
    expect(cfg.base).toBe('http://localhost:11434');
    expect(cfg.model).toBe('llama3.2:3b');
  });

  it('falls back to env defaults when headers missing', () => {
    const req = new Request('http://localhost');
    const cfg = readOllamaHeaders(req);
    expect(cfg.key).toBe(process.env.OLLAMA_API_KEY ?? '');
    expect(cfg.base).toBe(process.env.OLLAMA_BASE_URL || 'https://ollama.com');
    expect(cfg.model).toBe(process.env.OLLAMA_MODEL || 'gpt-oss:20b');
  });
});

describe('getOllamaConfig', () => {
  it('returns env defaults', () => {
    const cfg = getOllamaConfig();
    expect(cfg.base).toBeTruthy();
    expect(cfg.model).toBeTruthy();
  });
});

describe('postOllamaChat', () => {
  it('throws UpstreamError when no key provided', async () => {
    await expect(
      postOllamaChat({
        key: '',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toBeInstanceOf(UpstreamError);
  });

  it('returns content and model on 200', async () => {
    const original = global.fetch;
    global.fetch = mockFetch(200, {
      message: { role: 'assistant', content: 'hello there' },
    }) as typeof fetch;
    try {
      const r = await postOllamaChat({
        base: 'https://ollama.com',
        key: 'sk-test',
        model: 'gpt-oss:20b',
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(r.content).toBe('hello there');
      expect(r.modelUsed).toBe('gpt-oss:20b');
    } finally {
      global.fetch = original;
    }
  });

  it('throws UpstreamError on non-2xx', async () => {
    const original = global.fetch;
    global.fetch = mockFetch(401, { error: 'unauthorized' }) as typeof fetch;
    try {
      await expect(
        postOllamaChat({
          key: 'bad',
          messages: [{ role: 'user', content: 'x' }],
        }),
      ).rejects.toBeInstanceOf(UpstreamError);
    } finally {
      global.fetch = original;
    }
  });
});
