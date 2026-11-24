import { useMemo } from 'react';
import { getStopDistanceInfo, type NearbyStop } from '@/domain/stops';
import { nextDepartures } from '@/domain/departures';
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
import { LineBadge } from '@/components/LineBadge';
import { StopModeIcon } from '@/components/StopModeIcon';
import { LineBadges } from '@/components/LineBadges';
import { FALLBACK_ROUTE_COLOR } from '@/config/constants';
import type { Departure } from '@/types';
import { WalkDistance } from '@/components/WalkDistance';
import { MinutesUntil } from '@/components/MinutesUntil';
import { useOpenStop } from '@/hooks/features/useOpenStop';

interface NearbyStopRowProps {
    nearby: NearbyStop;
    location: [number, number] | null;
    departures: Departure[];
}

/** A stop near the user on the home sheet: its mode and lines, the next departure and the walk there; opens its board. */
export const NearbyStopRow = ({ nearby, location, departures }: NearbyStopRowProps) => {
    const openStop = useOpenStop();

    const { stop } = nearby;
    const distanceInfo = useMemo(() => getStopDistanceInfo(location, stop.pos), [location, stop.pos]);
    const next = useMemo(() => nextDepartures(departures, 1, true)[0], [departures]);

    const open = () => openStop(stop.id, { pos: stop.pos });

    return (
        <Item
            className="[--row-sep:3.875rem]"
            render={<button type="button" onClick={open} data-testid={`nearby-stop-${stop.id}`} />}
        >
            <ItemMedia variant="icon" className="size-9 rounded-full bg-fill-2 text-foreground [&_svg]:size-4.75!">
                <StopModeIcon lines={stop.lines} />
            </ItemMedia>
            <ItemContent className="min-w-0 gap-1">
                <ItemTitle className="w-full type-headsign text-foreground">
                    <span className="truncate">{stop.name}</span>
                </ItemTitle>
                <div className="flex flex-wrap items-center gap-y-1">
                    <LineBadges lines={stop.lines} />
                </div>
            </ItemContent>
            <ItemActions className="shrink-0 flex-col items-end gap-0.5">
                {next && (
                    <span className="flex items-center gap-1.5 type-headsign tabular-nums text-foreground">
                        <LineBadge name={String(next.line)} routeColor={next.route_color || FALLBACK_ROUTE_COLOR} size="row" />
                        <MinutesUntil timestamp={next.timestamp} />
                    </span>
                )}
                {distanceInfo && <WalkDistance info={distanceInfo} className="type-meta" />}
            </ItemActions>
        </Item>
    );
};
