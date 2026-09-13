import { Badge } from 'departs-ui';
import { ClockIcon, WifiIcon } from 'lucide-react';

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge>Live</Badge>
    <Badge variant="secondary">Scheduled</Badge>
    <Badge variant="soft">Low floor</Badge>
    <Badge variant="muted">Night line</Badge>
    <Badge variant="outline">Platform 2</Badge>
    <Badge variant="destructive">Cancelled</Badge>
  </div>
);

export const WithIcon = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="soft">
      <WifiIcon data-icon="inline-start" />
      Real-time
    </Badge>
    <Badge variant="destructive">
      <ClockIcon data-icon="inline-start" />
      +6 min
    </Badge>
  </div>
);

export const Monospace = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="outline" className="text-[10px] font-mono font-bold bg-foreground/5 border-border/40 text-muted-foreground px-2 py-0.5 rounded-full">
      ROPID-2291
    </Badge>
  </div>
);
