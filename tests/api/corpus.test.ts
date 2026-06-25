import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockReadFile = vi.fn();
const mockStat = vi.fn();

vi.mock('node:fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  stat: (...args: unknown[]) => mockStat(...args),
}));

import { GET } from '@/app/api/corpus/route';

function makeReq(url: string): Request {
  return new Request(url);
}

describe('GET /api/corpus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when address is missing', async () => {
    const res = await GET(makeReq('http://localhost/api/corpus'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when no corpus file is found', async () => {
    mockStat.mockRejectedValue(new Error('not found'));
    mockReadFile.mockRejectedValue(new Error('not found'));
    const res = await GET(
      makeReq('http://localhost/api/corpus?address=Nowhere+Place'),
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/No precomputed report/i);
  });

  it('returns the precomputed JSON with _corpus flag on hit', async () => {
    mockStat.mockResolvedValue({ isDirectory: () => true } as never);
    mockReadFile.mockResolvedValue(
      JSON.stringify({ address: 'CN Tower, Toronto', score: { total: 91 } }),
    );
    const res = await GET(
      makeReq('http://localhost/api/corpus?address=CN+Tower,+Toronto'),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body._corpus).toBe(true);
    expect(body.address).toBe('CN Tower, Toronto');
  });

  it('normalizes the address key (lowercase, dashes, trimmed)', async () => {
    mockStat.mockResolvedValue({ isDirectory: () => true } as never);
    mockReadFile.mockResolvedValue(JSON.stringify({ ok: true }));
    await GET(
      makeReq('http://localhost/api/corpus?address=CN%20TOWER%20%2C%20Toronto%21%21%21'),
    );
    expect(mockReadFile).toHaveBeenCalled();
    const call = mockReadFile.mock.calls[0]!;
    const pathArg = String(call[0]);
    expect(pathArg).toMatch(/cn-tower-toronto\.json$/);
  });
});
