import { Button, Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from 'departs-ui';
import { SearchXIcon, StarIcon, WifiOffIcon } from 'lucide-react';

export const NoFavorites = () => (
  <Empty className="py-10">
    <EmptyHeader>
      <EmptyMedia variant="icon" className="size-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary [&_svg:not([class*='size-'])]:size-7">
        <StarIcon strokeWidth={1.5} />
      </EmptyMedia>
      <EmptyTitle className="text-base font-bold text-foreground/90">No favorite stops yet</EmptyTitle>
      <EmptyDescription className="text-[13px] max-w-55">Tap the star icon on any stop's departure board to pin it here.</EmptyDescription>
    </EmptyHeader>
  </Empty>
);

export const LoadError = () => (
  <Empty className="py-10">
    <EmptyHeader>
      <EmptyMedia variant="icon" className="size-14 rounded-2xl border shadow-sm bg-destructive/10 border-destructive/20 text-destructive/90 [&_svg:not([class*='size-'])]:size-7">
        <WifiOffIcon strokeWidth={1.5} />
      </EmptyMedia>
      <EmptyTitle className="text-base font-bold text-foreground/90">Departures unavailable</EmptyTitle>
      <EmptyDescription className="text-[13px] max-w-55">We couldn't reach the live data source. Try again in a moment.</EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <Button variant="outline" size="sm">
        Retry
      </Button>
    </EmptyContent>
  </Empty>
);

export const Simple = () => (
  <Empty className="py-8">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <SearchXIcon />
      </EmptyMedia>
      <EmptyTitle>No results</EmptyTitle>
      <EmptyDescription>No stops match "Vyšehradská". Check the spelling or try a nearby street.</EmptyDescription>
    </EmptyHeader>
  </Empty>
);
