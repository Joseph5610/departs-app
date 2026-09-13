import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, MapPin, Star, Clock, Building2 } from 'lucide-react';
import { SearchItem } from './SearchItem';
import { getLineMetadataFromMap } from '@/utils/transitUtils';
import { searchHistoryKey } from '@/utils/searchHistory';
import {
    Command,
    CommandList,
    CommandGroup,
} from '@/components/ui/command';

import type { StopFeature, SearchHistoryItem } from '../../../types/transit';
import type { GeocodingResult } from '../../../hooks/data/useGeocoding';

interface SearchDropdownProps {
    results: StopFeature[];
    searchHistory: SearchHistoryItem[];
    favoriteStops: string[];
    query: string;
    activeFilter: string[] | null;
    isLineLike: boolean;
    linesFromQuery: string[];
    geocodingResults: GeocodingResult[];
    onStopSelect: (stop: StopFeature) => void;
    onHistorySelect: (item: SearchHistoryItem) => void;
    onLineSelect: (lines: string[]) => void;
    onPlaceSelect: (result: GeocodingResult) => void;
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
    isLineLike,
    linesFromQuery,
    geocodingResults,
    onStopSelect,
    onHistorySelect,
    onLineSelect,
    onPlaceSelect,
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
                                    <SearchIcon size={16} strokeWidth={1.5} />
                                }
                                title={
                                    item.type === 'stop' ? item.stop_name :
                                    item.type === 'place' ? item.name :
                                    t('search.lineFilter', { line: item.lines.join(', '), count: item.lines.length })
                                }
                                subtitle={
                                    item.type === 'stop' && item.platform_code ? t('search.platform', { code: item.platform_code }) :
                                    item.type === 'place' ? item.subtitle :
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

                {/* Line filter suggestion */}
                {isLineLike && (
                    <CommandGroup className="p-0">
                        <SearchItem
                            icon={<SearchIcon size={16} strokeWidth={1.5} />}
                            title={t('search.filterByLine')}
                            lines={linesFromQuery.map(l => {
                                const meta = getLineMetadataFromMap(l, lineMetadataMap);
                                return {
                                    name: l,
                                    type: meta?.type || 'bus',
                                    route_color: meta?.route_color
                                };
                            })}
                            variant="primary"
                            testId={`search-item-line-${linesFromQuery.join('-')}`}
                            onClick={() => onLineSelect(linesFromQuery)}
                        />
                    </CommandGroup>
                )}

                {/* Search results */}
                {query !== '' && results.length > 0 && (
                    <CommandGroup className="p-0">
                        {renderStopResults('res')}
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
