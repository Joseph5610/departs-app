import { LineBadge } from 'departs-ui';

export const Modes = () => (
  <div className="flex flex-wrap items-center gap-2">
    <LineBadge name="A" routeColor="#00A562" />
    <LineBadge name="B" routeColor="#F8B322" />
    <LineBadge name="C" routeColor="#CF003D" />
    <LineBadge name="22" routeColor="#7A0603" />
    <LineBadge name="136" routeColor="#007DA8" />
    <LineBadge name="S9" routeColor="#0A2A5E" />
    <LineBadge name="91" routeColor="#000000" />
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-3">
    <LineBadge name="22" routeColor="#7A0603" size="sm" />
    <LineBadge name="22" routeColor="#7A0603" size="md" />
    <LineBadge name="22" routeColor="#7A0603" size="lg" />
    <LineBadge name="22" routeColor="#7A0603" size="xl" />
  </div>
);

export const InDepartureRow = () => (
  <div className="w-full max-w-xs flex items-center gap-3 rounded-2xl bg-card border border-border/50 px-3 py-2.5">
    <LineBadge name="136" routeColor="#007DA8" size="lg" />
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold truncate">Jižní Město</div>
      <div className="text-xs text-muted-foreground">Stand B</div>
    </div>
    <div className="text-sm font-bold tabular-nums text-primary">3 min</div>
  </div>
);
