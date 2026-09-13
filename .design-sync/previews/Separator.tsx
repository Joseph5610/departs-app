import { Separator } from 'departs-ui';

export const Horizontal = () => (
  <div className="w-full max-w-xs">
    <div className="text-sm font-semibold">Anděl</div>
    <div className="text-xs text-muted-foreground">Metro B, trams 4, 5, 9, 10, 12, 15, 16, 20</div>
    <Separator className="my-3" />
    <div className="text-sm font-semibold">Smíchovské nádraží</div>
    <div className="text-xs text-muted-foreground">Metro B, trains S7, S65</div>
  </div>
);

export const Vertical = () => (
  <div className="flex h-5 items-center gap-3 text-sm">
    <span>Departures</span>
    <Separator orientation="vertical" />
    <span>Lines</span>
    <Separator orientation="vertical" />
    <span>Alerts</span>
  </div>
);
