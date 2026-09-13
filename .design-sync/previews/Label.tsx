import { Input, Label, Switch } from 'departs-ui';

export const WithInput = () => (
  <div className="w-full max-w-xs flex flex-col gap-1.5">
    <Label htmlFor="stop">Stop name</Label>
    <Input id="stop" placeholder="e.g. Hlavní nádraží" />
  </div>
);

export const WithSwitch = () => (
  <div className="flex items-center gap-3">
    <Switch id="labels" defaultChecked />
    <Label htmlFor="labels">Show stop labels</Label>
  </div>
);

export const SectionLabel = () => (
  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Message Type</Label>
);
