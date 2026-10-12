import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, MapPin, Star, Clock, Building2, Ticket, BusFront } from 'lucide-react';
import { SearchItem } from './SearchItem';
import { HistoryItemIcon } from './HistoryItemIcon';
import { historyItemSubtitle, historyItemTitle, posResultSubtitle, stopResultSubtitle, vehicleResultLines } from './searchItemText';
import type { LineBadgeData } from '@/domain/routes';
import { searchHistoryKey } from '@/lib/searchHistory';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { cn } from '@/lib/cn';

import type { StopFeature, SearchHistoryItem, VehicleFeature } from '@/types';
import { vehicleDisplayNumber } from '@/domain/vehicles';
import type { GeocodingResult } from '@/hooks/data/useGeocoding';
import type { PosSearchResult } from '@/domain/pointsOfSale';

interface SearchDropdownProps {
    results: StopFeature[];
    searchHistory: SearchHistoryItem[];
    favoriteStops: string[];
    query: string;
    activeFilter: string[] | null;
    queryLines: string[] | null;
    queryLineBadges: LineBadgeData[] | null;
    vehicleResults: VehicleFeature[];
    geocodingResults: GeocodingResult[];
    posResults: PosSearchResult[];
    onStopSelect: (stop: StopFeature) => void;
    onHistorySelect: (item: SearchHistoryItem) => void;
    onLineSelect: (lines: string[]) => void;
    onPlaceSelect: (result: GeocodingResult) => void;
    onPosSelect: (result: PosSearchResult) => void;
    onVehicleSelect: (vehicle: VehicleFeature) => void;
}

const SearchGroup = ({ heading, className, children }: { heading?: React.ReactNode; className?: string; children: React.ReactNode }) => (
    <Autocomplete.Group className={cn('overflow-hidden text-foreground p-0', className)}>
        {heading && (
            <Autocomplete.GroupLabel className="px-3 pt-3 pb-1.5 micro-label-widest text-muted-foreground">
                {heading}
            </Autocomplete.GroupLabel>
        )}
        {children}
    </Autocomplete.Group>
);

const GroupHeading = ({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) => (
    <div className="flex items-center justify-between w-full">
        <div className="flex gap-2 items-center">
            {icon}
            <span>{label}</span>
        </div>
        <span className="text-label font-semibold text-muted-foreground/80 bg-foreground/5 border border-border/50 px-2 py-0.5 rounded-full normal-case tracking-normal">
            {count}
        </span>
    </div>
);

/**
 * SearchDropdown
 *
 * Renders the dropdown panel below the search input as the Base UI Autocomplete list owned by Search.
 * Shows recent searches, favorites, line filter suggestions, and stop results.
 */
export const SearchDropdown = ({
    results,
    searchHistory,
    favoriteStops,
    query,
    activeFilter,
    queryLines,
    queryLineBadges,
    vehicleResults,
    geocodingResults,
    posResults,
    onStopSelect,
    onHistorySelect,
    onLineSelect,
    onPlaceSelect,
    onPosSelect,
    onVehicleSelect,
}: SearchDropdownProps) => {
    const { t } = useTranslation();
    const favoriteStopIds = useMemo(() => new Set(favoriteStops), [favoriteStops]);

    const showHistory = query === '' && !activeFilter && searchHistory.length > 0;

    const renderStopResults = (testIdPrefix: 'fav' | 'res') => results.map((stop) => {
        const isFavorite = favoriteStopIds.has(stop.properties.stop_id);
        return (
            <SearchItem
                key={stop.properties.stop_id}
                icon={isFavorite ? <Star size={16} fill="currentColor" strokeWidth={1.5} /> : <MapPin size={16} strokeWidth={1.5} />}
                title={stop.properties.stop_name}
                subtitle={stopResultSubtitle(stop, t)}
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
            <Autocomplete.List className="max-h-[60vh] overflow-y-auto custom-scrollbar space-y-1">
                {showHistory && (
                    <SearchGroup
                        heading={<GroupHeading icon={<Clock size={14} className="text-primary" strokeWidth={2} />} label={t('search.recent')} count={searchHistory.length} />}
                    >
                        {searchHistory.map((item) => (
                            <SearchItem
                                key={searchHistoryKey(item)}
                                icon={<HistoryItemIcon type={item.type} />}
                                title={historyItemTitle(item, t)}
                                subtitle={historyItemSubtitle(item, t)}
                                metroLines={item.type === 'stop' ? item.metro_lines : undefined}
                                lines={item.type === 'stop' ? item.lines : undefined}
                                testId={`search-item-hist-${searchHistoryKey(item)}`}
                                onClick={() => onHistorySelect(item)}
                            />
                        ))}
                    </SearchGroup>
                )}

                {query === '' && results.length > 0 && (
                    <SearchGroup
                        heading={<GroupHeading icon={<Star size={14} className="text-favorite fill-favorite/20" strokeWidth={2} />} label={t('search.favorites')} count={results.length} />}
                    >
                        {renderStopResults('fav')}
                    </SearchGroup>
                )}

                {vehicleResults.length > 0 && (
                    <SearchGroup
                        heading={<GroupHeading icon={<BusFront size={14} className="text-primary" strokeWidth={2} />} label={t('search.vehicles')} count={vehicleResults.length} />}
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
                                    lines={vehicleResultLines(vehicle)}
                                    testId={`search-item-vehicle-${vehicleId}`}
                                    onClick={() => onVehicleSelect(vehicle)}
                                />
                            );
                        })}
                    </SearchGroup>
                )}

                {queryLines && (
                    <SearchGroup>
                        <SearchItem
                            icon={<SearchIcon size={16} strokeWidth={1.5} />}
                            title={t('search.filterByLine')}
                            lines={queryLineBadges ?? undefined}
                            variant="primary"
                            testId={`search-item-line-${queryLines.join('-')}`}
                            onClick={() => onLineSelect(queryLines)}
                        />
                    </SearchGroup>
                )}

                {query !== '' && results.length > 0 && (
                    <SearchGroup>
                        {renderStopResults('res')}
                    </SearchGroup>
                )}

                {posResults.length > 0 && (
                    <SearchGroup
                        heading={<GroupHeading icon={<Ticket size={14} className="text-emerald-500" strokeWidth={2} />} label={t('search.pointsOfSale')} count={posResults.length} />}
                    >
                        {posResults.map((result) => (
                            <SearchItem
                                key={result.pos.id}
                                icon={<Ticket size={16} strokeWidth={1.5} />}
                                title={result.pos.name}
                                subtitle={posResultSubtitle(result, t)}
                                testId={`search-item-pos-${result.pos.id}`}
                                onClick={() => onPosSelect(result)}
                            />
                        ))}
                    </SearchGroup>
                )}

                {geocodingResults.length > 0 && (
                    <SearchGroup
                        heading={<GroupHeading icon={<Building2 size={14} className="text-primary" strokeWidth={2} />} label={t('search.places')} count={geocodingResults.length} />}
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
                    </SearchGroup>
                )}
            </Autocomplete.List>
        </div>
    );
};
