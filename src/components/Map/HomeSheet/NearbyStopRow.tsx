import { useMemo } from 'react';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useMapMetadataStore } from '@/state/mapMetadataStore';
import { getStopDistanceInfo, type NearbyStop } from '@/domain/stops';
import { nextDepartures } from '@/domain/departures';
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
import { LineBadge } from '@/components/LineBadge';
import { StopModeIcon } from '@/components/StopModeIcon';
import { FALLBACK_ROUTE_COLOR, MAP_CAMERA, STOP_SEARCH } from '@/config/constants';
import type { Departure } from '@/types';
import { WalkDistance } from '@/components/WalkDistance';
import { MinutesUntil } from '@/components/MinutesUntil';

interface NearbyStopRowProps {
    nearby: NearbyStop;
    location: [number, number] | null;
    departures: Departure[];
}

/** A stop near the user on the home sheet: its mode and lines, the next departure and the walk there; opens its board. */
export const NearbyStopRow = ({ nearby, location, departures }: NearbyStopRowProps) => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const flyTo = useMapMetadataStore(s => s.actions.flyTo);

    const { stop_id, stop_name, lines } = nearby.feature.properties;
    const coordinates = nearby.feature.geometry.coordinates;
    const distanceInfo = useMemo(() => getStopDistanceInfo(location, coordinates), [location, coordinates]);
    const next = useMemo(() => nextDepartures(departures, 1, true)[0], [departures]);

    const open = () => {
        flyTo({ center: coordinates, zoom: MAP_CAMERA.STOP_SELECT_ZOOM, duration: MAP_CAMERA.FLY_MS });
        navigate(paths.stop(selectedCity, stop_id));
    };

    return (
        <Item
            variant="settings"
            size="none"
            className="flex-nowrap text-left"
            render={<button type="button" onClick={open} data-testid={`nearby-stop-${stop_id}`} />}
        >
            <ItemMedia variant="icon" className="size-9 rounded-full bg-primary/10 text-primary">
                <StopModeIcon lines={lines} />
            </ItemMedia>
            <ItemContent className="min-w-0 gap-1.5">
                <ItemTitle className="w-full text-title font-semibold text-foreground">
                    <span className="truncate">{stop_name}</span>
                </ItemTitle>
                <div className="flex flex-wrap items-center gap-1">
                    {lines?.slice(0, STOP_SEARCH.LINE_BADGE_LIMIT).map(line => (
                        <LineBadge key={line.name} name={line.name} routeColor={line.route_color || FALLBACK_ROUTE_COLOR} size="sm" />
                    ))}
                </div>
            </ItemContent>
            <ItemActions className="shrink-0 flex-col items-end gap-1.5">
                {next && (
                    <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-foreground">
                        <LineBadge name={String(next.line)} routeColor={next.route_color || FALLBACK_ROUTE_COLOR} size="sm" />
                        <MinutesUntil timestamp={next.timestamp} />
                    </span>
                )}
                {distanceInfo && <WalkDistance info={distanceInfo} />}
            </ItemActions>
        </Item>
    );
};
