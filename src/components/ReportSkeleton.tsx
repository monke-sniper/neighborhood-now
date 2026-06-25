import { SkeletonBar, SkeletonBlock, SkeletonText } from './Skeleton';

const SCORE_LABELS = [
  'AMENITY DENSITY',
  'TRANSIT SCORE',
  'FOOD ACCESS',
  'GREEN SPACE',
  'DEVELOPMENT',
  'CIVIC SCORE',
  'CULTURE SCORE',
  'RECREATION',
  'SERVICES',
];

const COUNT_LABELS = [
  'RESTAURANTS',
  'CAFÉS',
  'SCHOOLS',
  'GROCERY',
  'PARKS',
  'RECREATION',
  'CIVIC',
  'CULTURE',
  'SERVICES',
  'TRANSIT',
  'PERMITS',
  'COMPLAINTS',
];

export function ReportSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 p-4 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <SkeletonBlock className="h-32 w-full" />
          <SkeletonText width="w-2/3" />
        </div>
        <div className="flex flex-col gap-3 p-4 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
            <SkeletonText width="w-40" />
            <SkeletonText width="w-32" />
          </div>
          <div className="flex items-baseline gap-3">
            <SkeletonBlock className="h-16 w-24" />
            <SkeletonText width="w-8" />
          </div>
          <div className="flex flex-col gap-2">
            {SCORE_LABELS.map((label) => (
              <SkeletonBar key={label} />
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 pt-2 border-t border-[var(--color-border)]">
            {COUNT_LABELS.map((label) => (
              <div key={label} className="flex justify-between gap-2">
                <SkeletonText width="w-20" />
                <SkeletonText width="w-8" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 p-4 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <SkeletonText width="w-32" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between">
              <SkeletonText width="w-40" />
              <SkeletonText width="w-16" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-3 p-4 border border-[var(--color-border)] bg-[var(--color-surface)]"
          >
            <SkeletonText width="w-40" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-5/6" />
            <SkeletonBlock className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
