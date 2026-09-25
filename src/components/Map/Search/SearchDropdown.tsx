import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, MapPin, Star, Clock, Building2, Ticket, BusFront } from 'lucide-react';
import { SearchItem } from './SearchItem';
import { getLineMetadataFromMap } from '@/utils/transitUtils';
import { searchHistoryKey } from '@/utils/searchHistory';
import {
    Command,
    CommandList,
    CommandGroup,
} from '@/components/ui/command';

import type { StopFeature, SearchHistoryItem, VehicleFeature } from '../../../types/transit';
import { vehicleDisplayNumber } from '@/utils/vehicleSearch';
import type { GeocodingResult } from '../../../hooks/data/useGeocoding';
import type { PosSearchResult } from '../../../utils/posSearch';

interface SearchDropdownProps {
    results: StopFeature[];
    searchHistory: SearchHistoryItem[];
    favoriteStops: string[];
    query: string;
    activeFilter: string[] | null;
    queryLines: string[] | null;
    vehicleResults: VehicleFeature[];
    geocodingResults: GeocodingResult[];
    posResults: PosSearchResult[];
    onStopSelect: (stop: StopFeature) => void;
    onHistorySelect: (item: SearchHistoryItem) => void;
    onLineSelect: (lines: string[]) => void;
    onPlaceSelect: (result: GeocodingResult) => void;
    onPosSelect: (result: PosSearchResult) => void;
    onVehicleSelect: (vehicle: VehicleFeature) => void;
    lineMetadataMap: Map<string, { route_color: string; type: string }>;
}

const GroupHeading: React.FC<{ icon: React.ReactNode; label: string; count: number }> = ({ icon, label, count }) => (
    <div className="flex items-center justify-between w-full">
        <div className="flex gap-2 items-center">
            {icon}
            <span>{label}</span>
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground/80 bg-foreground/5 border border-border/50 px-2 py-0.5 rounded-full normal-case tracking-normal">
            {count}
        </span>
    </div>
);

/**
 * SearchDropdown
 *
 * Renders the dropdown panel below the search input using Shadcn Command primitives.
 * Shows recent searches, favorites, line filter suggestions, and stop results.
 */
export const SearchDropdown: React.FC<SearchDropdownProps> = ({
    results,
    searchHistory,
    favoriteStops,
    query,
    activeFilter,
    queryLines,
    vehicleResults,
    geocodingResults,
    posResults,
    onStopSelect,
    onHistorySelect,
    onLineSelect,
    onPlaceSelect,
    onPosSelect,
    onVehicleSelect,
    lineMetadataMap
}) => {
    const { t } = useTranslation();
    const favoriteStopIds = React.useMemo(() => new Set(favoriteStops), [favoriteStops]);

    const showHistory = query === '' && !activeFilter && searchHistory.length > 0;

    const renderStopResults = (testIdPrefix: 'fav' | 'res') => results.map((stop) => {
        const isFavorite = favoriteStopIds.has(stop.properties.stop_id);
        return (
            <SearchItem
                key={stop.properties.stop_id}
                icon={isFavorite ? <Star size={16} fill="currentColor" strokeWidth={1.5} /> : <MapPin size={16} strokeWidth={1.5} />}
                title={stop.properties.stop_name}
                subtitle={stop.properties.platform_code ? t('search.platform', { code: stop.properties.platform_code }) : undefined}
                metroLines={stop.properties.metro_lines}
                lines={stop.properties.lines}
                highlight={isFavorite}
                testId={`search-item-${testIdPrefix}-stop-${stop.properties.stop_id}`}
                onClick={() => onStopSelect(stop)}
            />
        );
    });

    return (
        <div className="mt-2 overflow-hidden max-h-[60vh] rounded-2xl glassy p-1.5 shadow-xl">
            <Command
                shouldFilter={false}
                className="bg-transparent! p-0 rounded-none!"
            >
                <CommandList className="max-h-[60vh] overflow-y-auto custom-scrollbar space-y-1">
                {showHistory && (
                    <CommandGroup
                        heading={<GroupHeading icon={<Clock size={14} className="text-primary" strokeWidth={2} />} label={t('search.recent')} count={searchHistory.length} />}
                        variant="search"
                    >
                        {searchHistory.map((item) => (
                            <SearchItem
                                key={searchHistoryKey(item)}
                                icon={
                                    item.type === 'stop' ? <MapPin size={16} strokeWidth={1.5} /> :
                                    item.type === 'place' ? <Building2 size={16} strokeWidth={1.5} /> :
                                    item.type === 'pos' ? <Ticket size={16} strokeWidth={1.5} /> :
                                    <SearchIcon size={16} strokeWidth={1.5} />
                                }
                                title={
                                    item.type === 'stop' ? item.stop_name :
                                    item.type === 'place' || item.type === 'pos' ? item.name :
                                    t('search.lineFilter', { line: item.lines.join(', '), count: item.lines.length })
                                }
                                subtitle={
                                    item.type === 'stop' && item.platform_code ? t('search.platform', { code: item.platform_code }) :
                                    item.type === 'place' || item.type === 'pos' ? item.subtitle :
                                    undefined
                                }
                                metroLines={item.type === 'stop' ? item.metro_lines : undefined}
                                lines={item.type === 'stop' ? item.lines : undefined}
                                testId={`search-item-hist-${searchHistoryKey(item)}`}
                                onClick={() => onHistorySelect(item)}
                            />
                        ))}
                    </CommandGroup>
                )}

                {/* Favorites heading */}
                {query === '' && results.length > 0 && (
                    <CommandGroup
                        heading={<GroupHeading icon={<Star size={14} className="text-amber-500 fill-amber-500/20" strokeWidth={2} />} label={t('search.favorites')} count={results.length} />}
                        variant="search"
                    >
                        {renderStopResults('fav')}
                    </CommandGroup>
                )}

                {/* Live vehicles by number */}
                {vehicleResults.length > 0 && (
                    <CommandGroup
                        heading={<GroupHeading icon={<BusFront size={14} className="text-primary" strokeWidth={2} />} label={t('search.vehicles')} count={vehicleResults.length} />}
                        variant="search"
                    >
                        {vehicleResults.map((vehicle) => {
                            const p = vehicle.properties;
                            const vehicleId = p.vehicle_id ?? '';
                            return (
                                <SearchItem
                                    key={vehicleId}
                                    icon={<BusFront size={16} strokeWidth={1.5} />}
                                    title={t('search.vehicleNumber', { number: vehicleDisplayNumber(vehicleId) })}
                                    subtitle={p.trip_headsign}
                                    lines={[{ name: String(p.route_short_name), type: p.route_type, route_color: p.route_color }]}
                                    testId={`search-item-vehicle-${vehicleId}`}
                                    onClick={() => onVehicleSelect(vehicle)}
                                />
                            );
                        })}
                    </CommandGroup>
                )}

                {/* Line filter suggestion */}
                {queryLines && (
                    <CommandGroup className="p-0">
                        <SearchItem
                            icon={<SearchIcon size={16} strokeWidth={1.5} />}
                            title={t('search.filterByLine')}
                            lines={queryLines.map(l => {
                                const meta = getLineMetadataFromMap(l, lineMetadataMap);
                                return {
                                    name: l,
                                    type: meta?.type || 'bus',
                                    route_color: meta?.route_color
                                };
                            })}
                            variant="primary"
                            testId={`search-item-line-${queryLines.join('-')}`}
                            onClick={() => onLineSelect(queryLines)}
                        />
                    </CommandGroup>
                )}

                {/* Search results */}
                {query !== '' && results.length > 0 && (
                    <CommandGroup className="p-0">
                        {renderStopResults('res')}
                    </CommandGroup>
                )}

                {/* Points of sale */}
                {posResults.length > 0 && (
                    <CommandGroup
                        heading={<GroupHeading icon={<Ticket size={14} className="text-emerald-500" strokeWidth={2} />} label={t('search.pointsOfSale')} count={posResults.length} />}
                        variant="search"
                    >
                        {posResults.map((result) => (
                            <SearchItem
                                key={result.pos.id}
                                icon={<Ticket size={16} strokeWidth={1.5} />}
                                title={result.pos.name}
                                subtitle={[t(`pos.types.${result.pos.type}`, result.pos.type), result.pos.address].filter(Boolean).join(' · ')}
                                testId={`search-item-pos-${result.pos.id}`}
                                onClick={() => onPosSelect(result)}
                            />
                        ))}
                    </CommandGroup>
                )}

                {/* Geocoding / places */}
                {geocodingResults.length > 0 && (
                    <CommandGroup
                        heading={<GroupHeading icon={<Building2 size={14} className="text-primary" strokeWidth={2} />} label={t('search.places')} count={geocodingResults.length} />}
                        variant="search"
                    >
                        {geocodingResults.map((place) => (
                            <SearchItem
                                key={place.id}
                                icon={<Building2 size={16} strokeWidth={1.5} />}
                                title={place.name}
                                subtitle={place.subtitle || undefined}
                                testId={`search-item-place-${place.id}`}
                                onClick={() => onPlaceSelect(place)}
                            />
                        ))}
                    </CommandGroup>
                )}
            </CommandList>
        </Command>
        </div>
    );
};

SearchDropdown.displayName = 'SearchDropdown';
