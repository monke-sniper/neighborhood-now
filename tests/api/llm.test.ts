import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockPostOllama = vi.fn();
const mockReadHeaders = vi.fn();

vi.mock('@/lib/llm/ollama', () => ({
  postOllamaChat: (...args: unknown[]) => mockPostOllama(...args),
  readOllamaHeaders: (...args: unknown[]) => mockReadHeaders(...args),
}));

import { POST as chatPost } from '@/app/api/chat/route';
import { POST as recommendPost } from '@/app/api/recommend/route';

function makeJsonReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const fakeReport = {
  address: 'CN Tower, Toronto',
  coords: { lat: 43.6426, lon: -79.3871 },
  fetchedAt: new Date().toISOString(),
  radiusMeters: 3000,
  score: {
    total: 91,
    breakdown: {
      amenityDensity: 50,
      transitScore: 80,
      foodAccess: 70,
      greenSpace: 40,
      development: 30,
      civicScore: 60,
      cultureScore: 55,
      recreationScore: 45,
      serviceScore: 50,
    },
    presence: {},
    cityAverage: 60,
    ranking: { percentile: 90, label: 'A' },
  },
  explanations: [],
  amenities: { amenities: [], buildings: [], transit: [], landuse: [], rawCount: 0 },
  permits: [],
  complaints: [],
  anomalies: [],
  trends: [],
  sources: { overpass: 'ok', builddata: 'ok', complaints: 'ok', census: 'ok', weather: 'ok' },
} as unknown as Record<string, unknown>;

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 on invalid JSON', async () => {
    const res = await chatPost(
      new Request('http://localhost/api/chat', { method: 'POST', body: '{not json' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when question or report is missing', async () => {
    const res = await chatPost(makeJsonReq({ question: 'hi' }));
    expect(res.status).toBe(400);
  });

  it('returns stub answer when no Ollama key configured', async () => {
    mockReadHeaders.mockReturnValue({ key: '', base: 'https://ollama.com', model: 'm' });
    const res = await chatPost(
      makeJsonReq({ question: 'Is it safe?', report: fakeReport }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { answer: string; modelUsed: string };
    expect(body.modelUsed).toBe('stub');
    expect(body.answer).toMatch(/not configured/i);
    expect(mockPostOllama).not.toHaveBeenCalled();
  });

  it('returns the model answer on success', async () => {
    mockReadHeaders.mockReturnValue({ key: 'k', base: 'https://ollama.com', model: 'm' });
    mockPostOllama.mockResolvedValue({ content: 'Looks great.', modelUsed: 'm' });
    const res = await chatPost(
      makeJsonReq({ question: 'Is it safe?', report: fakeReport }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { answer: string; modelUsed: string };
    expect(body.answer).toBe('Looks great.');
    expect(body.modelUsed).toBe('m');
  });

  it('returns a friendly error on upstream failure', async () => {
    mockReadHeaders.mockReturnValue({ key: 'k', base: 'https://ollama.com', model: 'm' });
    const { UpstreamError } = await import('@/lib/errors');
    mockPostOllama.mockRejectedValue(new UpstreamError('ollama', 'boom', { status: 500 }));
    const res = await chatPost(
      makeJsonReq({ question: 'Is it safe?', report: fakeReport }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { answer: string };
    expect(body.answer).toMatch(/error/i);
  });
});

describe('POST /api/recommend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when report is missing', async () => {
    const res = await recommendPost(makeJsonReq({}));
    expect(res.status).toBe(400);
  });

  it('returns fallback recommendations when no Ollama key configured', async () => {
    mockReadHeaders.mockReturnValue({ key: '', base: 'https://ollama.com', model: 'm' });
    const res = await recommendPost(makeJsonReq({ report: fakeReport }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      recommendations: unknown[];
      modelUsed: string;
    };
    expect(Array.isArray(body.recommendations)).toBe(true);
    expect(body.recommendations.length).toBeGreaterThan(0);
    expect(body.modelUsed).toBe('fallback');
  });

  it('uses model output when available and falls back to stub on parse failure', async () => {
    mockReadHeaders.mockReturnValue({ key: 'k', base: 'https://ollama.com', model: 'm' });
    mockPostOllama
      .mockResolvedValueOnce({ content: 'not json', modelUsed: 'm' })
      .mockResolvedValueOnce({ content: 'some ideas', modelUsed: 'm' });
    const res = await recommendPost(makeJsonReq({ report: fakeReport }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { modelUsed: string; ideas: string };
    expect(body.modelUsed).toBe('m');
    expect(body.ideas).toBe('some ideas');
  });
});
