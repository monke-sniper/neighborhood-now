import { describe, expect, it } from 'vitest';

describe('Skeleton module', () => {
  it('exports SkeletonBlock, SkeletonBar, SkeletonText', async () => {
    const mod = await import('@/components/Skeleton');
    expect(typeof mod.SkeletonBlock).toBe('function');
    expect(typeof mod.SkeletonBar).toBe('function');
    expect(typeof mod.SkeletonText).toBe('function');
  });
});

describe('ReportSkeleton module', () => {
  it('exports ReportSkeleton', async () => {
    const mod = await import('@/components/ReportSkeleton');
    expect(typeof mod.ReportSkeleton).toBe('function');
  });
});
