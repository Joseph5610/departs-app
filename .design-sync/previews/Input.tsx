import { Input, Label } from 'departs-ui';

export const Default = () => (
  <div className="w-full max-w-xs">
    <Input placeholder="Search stops, lines or places" />
  </div>
);

export const WithLabel = () => (
  <div className="w-full max-w-xs flex flex-col gap-1.5">
    <Label htmlFor="email">Email (optional)</Label>
    <Input id="email" type="email" placeholder="name@example.com" className="rounded-xl border-border/80 bg-card text-sm h-11" />
  </div>
);

export const States = () => (
  <div className="w-full max-w-xs flex flex-col gap-3">
    <Input defaultValue="Malostranské náměstí" />
    <Input disabled placeholder="Disabled" />
    <Input aria-invalid defaultValue="jan.novak@" />
  </div>
);
