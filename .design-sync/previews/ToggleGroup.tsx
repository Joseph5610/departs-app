import { ToggleGroup, ToggleGroupItem } from 'departs-ui';
import { BusIcon, TrainFrontIcon, TramFrontIcon } from 'lucide-react';

export const Single = () => (
  <ToggleGroup variant="outline" defaultValue={['light']}>
    <ToggleGroupItem value="system">System</ToggleGroupItem>
    <ToggleGroupItem value="light">Light</ToggleGroupItem>
    <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
  </ToggleGroup>
);

export const Multiple = () => (
  <ToggleGroup multiple variant="outline" defaultValue={['metro', 'tram']}>
    <ToggleGroupItem value="metro" aria-label="Metro">
      <TrainFrontIcon />
    </ToggleGroupItem>
    <ToggleGroupItem value="tram" aria-label="Tram">
      <TramFrontIcon />
    </ToggleGroupItem>
    <ToggleGroupItem value="bus" aria-label="Bus">
      <BusIcon />
    </ToggleGroupItem>
  </ToggleGroup>
);

export const Small = () => (
  <ToggleGroup size="sm" defaultValue={['cs']}>
    <ToggleGroupItem value="cs">CS</ToggleGroupItem>
    <ToggleGroupItem value="en">EN</ToggleGroupItem>
    <ToggleGroupItem value="sk">SK</ToggleGroupItem>
  </ToggleGroup>
);
