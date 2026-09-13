import { Card, Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle, Switch } from 'departs-ui';
import { PaletteIcon } from 'lucide-react';

export const States = () => (
  <div className="flex items-center gap-4">
    <Switch defaultChecked aria-label="On" />
    <Switch aria-label="Off" />
    <Switch disabled aria-label="Disabled" />
  </div>
);

export const Small = () => (
  <div className="flex items-center gap-4">
    <Switch size="sm" defaultChecked aria-label="On" />
    <Switch size="sm" aria-label="Off" />
  </div>
);

export const SettingRow = () => (
  <div className="w-full max-w-sm">
    <Card variant="subtle" size="none">
      <Item>
        <ItemMedia variant="icon">
          <PaletteIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Vehicle colors by delay</ItemTitle>
          <ItemDescription className="text-xs">Color map vehicle markers based on current delay instead of line color</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Switch defaultChecked className="ml-3 sm:ml-4" />
        </ItemActions>
      </Item>
    </Card>
  </div>
);
