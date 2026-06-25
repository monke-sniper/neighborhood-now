import type { CSSProperties } from 'react';

interface SkeletonBlockProps {
  className?: string;
  style?: CSSProperties;
}

export function SkeletonBlock({ className = '', style }: SkeletonBlockProps) {
  return (
    <div
      aria-hidden="true"
      className={`bg-[var(--color-surface-3)] animate-pulse ${className}`}
      style={style}
    />
  );
}

interface SkeletonBarProps {
  labelWidth?: string;
}

export function SkeletonBar({ labelWidth = 'w-32' }: SkeletonBarProps) {
  return (
    <div className="flex items-center gap-3">
      <SkeletonBlock className={`h-3 ${labelWidth}`} />
      <SkeletonBlock className="h-3 flex-1" />
      <SkeletonBlock className="h-3 w-10" />
      <SkeletonBlock className="h-3 w-16" />
    </div>
  );
}

interface SkeletonTextProps {
  width?: string;
}

export function SkeletonText({ width = 'w-full' }: SkeletonTextProps) {
  return <SkeletonBlock className={`h-3 ${width}`} />;
}
