import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[#30303A] bg-[#17171D] px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#30303A] bg-[#1E1E27] text-[#B29AF5]">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-[#F5F5F7]">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[#A0A0AD]">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#9275E8] px-4 py-2 text-sm font-medium text-[#101014] transition-colors hover:bg-[#B29AF5] whitespace-nowrap shrink-0"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
