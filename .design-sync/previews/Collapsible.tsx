import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger, LineBadge } from 'departs-ui';
import { ChevronsUpDownIcon } from 'lucide-react';

export const Open = () => (
  <div className="w-full max-w-xs">
    <Collapsible defaultOpen className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Biggest Delays</span>
        <CollapsibleTrigger render={<Button variant="ghost" size="icon-xs" aria-label="Toggle"><ChevronsUpDownIcon /></Button>} />
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm">
        <LineBadge name="136" routeColor="#007DA8" size="sm" />
        <span className="flex-1">Jižní Město</span>
        <span className="font-bold text-destructive tabular-nums">+12 min</span>
      </div>
      <CollapsibleContent className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm">
          <LineBadge name="22" routeColor="#7A0603" size="sm" />
          <span className="flex-1">Bílá Hora</span>
          <span className="font-bold text-amber-500 tabular-nums">+7 min</span>
        </div>
      </CollapsibleContent>
    </Collapsible>
  </div>
);
