import { Skeleton } from 'departs-ui';

export const DepartureRows = () => (
  <div className="w-full max-w-xs flex flex-col gap-3">
    {[0, 1, 2].map((i) => (
      <div key={i} className="flex items-center gap-3">
        <Skeleton className="h-6 w-10 rounded-sm" />
        <div className="flex-1 flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-4 w-10" />
      </div>
    ))}
  </div>
);

export const CardPlaceholder = () => (
  <div className="w-full max-w-xs rounded-2xl border border-border/50 bg-card p-4 flex flex-col gap-3">
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-20 w-full rounded-xl" />
  </div>
);
