export function SkeletonCard() {
  return (
    <div
      className="flex flex-col rounded-xl border border-[#30303A] bg-[#1E1E27] p-3"
      aria-hidden="true"
    >
      <div className="aspect-[2/3] w-full animate-pulse rounded-lg bg-[#17171D]" />
      <div className="mt-3 space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-[#17171D]" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-[#17171D]" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-[#17171D]" />
      </div>
    </div>
  );
}
