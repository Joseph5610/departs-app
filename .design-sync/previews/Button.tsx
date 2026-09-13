import { Button } from 'departs-ui';
import { ArrowRightIcon, LocateFixedIcon, RefreshCwIcon, SettingsIcon, StarIcon, Trash2Icon } from 'lucide-react';

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button>Show departures</Button>
    <Button variant="secondary">Filter lines</Button>
    <Button variant="outline">Change city</Button>
    <Button variant="ghost">Cancel</Button>
    <Button variant="tinted">Nearby stops</Button>
    <Button variant="destructive">Remove favorite</Button>
    <Button variant="link">View timetable</Button>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button size="sm">Small</Button>
    <Button>Default</Button>
    <Button size="lg">Large</Button>
    <Button size="xl">Plan a trip</Button>
  </div>
);

export const WithIcon = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button>
      Full timetable
      <ArrowRightIcon />
    </Button>
    <Button variant="outline">
      <RefreshCwIcon />
      Refresh
    </Button>
    <Button variant="destructive" size="sm">
      <Trash2Icon />
      Clear history
    </Button>
  </div>
);

export const IconOnly = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button size="icon" variant="tinted" aria-label="Locate me">
      <LocateFixedIcon />
    </Button>
    <Button size="icon-sm" variant="outline" aria-label="Settings">
      <SettingsIcon />
    </Button>
    <Button size="icon-xs" variant="ghost" aria-label="Add to favorites">
      <StarIcon />
    </Button>
  </div>
);

export const Disabled = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button disabled>Show departures</Button>
    <Button variant="outline" disabled>
      Change city
    </Button>
  </div>
);
