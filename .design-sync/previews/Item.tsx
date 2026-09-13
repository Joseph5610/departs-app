import { Button, Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle, Switch } from 'departs-ui';
import { ChevronRightIcon, EyeIcon, MapPinIcon, TicketIcon } from 'lucide-react';

export const Variants = () => (
  <div className="w-full max-w-sm flex flex-col gap-3">
    <Item variant="outline">
      <ItemMedia variant="icon">
        <MapPinIcon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Malostranská</ItemTitle>
        <ItemDescription>Metro A, trams 2, 12, 15, 18, 20, 22</ItemDescription>
      </ItemContent>
      <ItemActions>
        <ChevronRightIcon className="size-4 text-muted-foreground" />
      </ItemActions>
    </Item>
    <Item variant="muted">
      <ItemMedia variant="icon">
        <TicketIcon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Ticket machine</ItemTitle>
        <ItemDescription>Cards and contactless, open 24/7</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button variant="outline" size="sm">
          Route
        </Button>
      </ItemActions>
    </Item>
  </div>
);

export const SettingsGroup = () => (
  <div className="w-full max-w-sm rounded-2xl border border-border/50 bg-card shadow-sm">
    <ItemGroup className="gap-0">
      <Item variant="settings">
        <ItemMedia variant="icon">
          <EyeIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Live vehicle locations</ItemTitle>
          <ItemDescription className="text-xs">Show buses, trams, and metro</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Switch defaultChecked />
        </ItemActions>
      </Item>
      <Item variant="settings">
        <ItemMedia variant="icon">
          <MapPinIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Show stops</ItemTitle>
          <ItemDescription className="text-xs">Show transport stops and stations</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Switch />
        </ItemActions>
      </Item>
    </ItemGroup>
  </div>
);

export const WithSeparator = () => (
  <div className="w-full max-w-sm">
    <ItemGroup className="gap-0">
      <Item size="sm">
        <ItemContent>
          <ItemTitle>Anděl</ItemTitle>
          <ItemDescription>Metro B, trams 4, 5, 9, 10</ItemDescription>
        </ItemContent>
      </Item>
      <ItemSeparator />
      <Item size="sm">
        <ItemContent>
          <ItemTitle>Smíchovské nádraží</ItemTitle>
          <ItemDescription>Metro B, trains S7, S65</ItemDescription>
        </ItemContent>
      </Item>
    </ItemGroup>
  </div>
);
