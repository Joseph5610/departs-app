import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, MapPin, Star, Clock, Building2 } from 'lucide-react';
import { SearchItem } from './SearchItem';
import { getLineMetadataFromMap } from '@/utils/transitUtils';
import {
    Command,
    CommandList,
    CommandGroup,
    CommandSeparator,
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

    const showHistory = query === '' && !activeFilter && searchHistory.length > 0;

    return (
        <div className="mt-2 overflow-hidden max-h-[60vh] rounded-2xl glassy">
            <Command
                shouldFilter={false}
                className="bg-transparent! p-0 rounded-none!"
            >
                <CommandList className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                {showHistory && (
                    <CommandGroup
                        heading={
                            <div className="flex gap-1.5 items-center">
                                <Clock size={12} className="text-muted-foreground -mt-[1px]" strokeWidth={1.5} />
                                <span className="leading-none">{t('search.recent')}</span>
                            </div>
                        }
                        className="[&_[cmdk-group-heading]]:bg-muted/50 [&_[cmdk-group-heading]]:border-b [&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest p-0"
                    >
                        {searchHistory.map((item) => (
                            <SearchItem
                                key={
                                    item.type === 'stop' ? `hist-stop-${item.stop_id}` :
                                    item.type === 'place' ? `hist-place-${item.place_id}` :
                                    `hist-line-${item.lines.join('-')}`
                                }
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
                                testId={
                                    item.type === 'stop' ? `search-item-hist-stop-${item.stop_id}` :
                                    item.type === 'place' ? `search-item-hist-place-${item.place_id}` :
                                    `search-item-hist-line-${item.lines.join('-')}`
                                }
                                onClick={() => onHistorySelect(item)}
                            />
                        ))}
                    </CommandGroup>
                )}

                {/* Favorites heading */}
                {query === '' && results.length > 0 && (
                    <>
                        {showHistory && <CommandSeparator />}
                        <CommandGroup
                            heading={
                                <div className="flex gap-1.5 items-center">
                                    <Star size={12} fill="currentColor" className="text-muted-foreground -mt-[1px]" strokeWidth={1.5} />
                                    <span className="leading-none">{t('search.favorites')}</span>
                                </div>
                            }
                            className="[&_[cmdk-group-heading]]:bg-muted/50 [&_[cmdk-group-heading]]:border-b [&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest p-0"
                        >
                            {results.map((stop) => (
                                <SearchItem
                                    key={stop.properties.stop_id}
                                    icon={favoriteStops.includes(stop.properties.stop_id) ? <Star size={16} fill="currentColor" strokeWidth={1.5} /> : <MapPin size={16} strokeWidth={1.5} />}
                                    title={stop.properties.stop_name}
                                    subtitle={stop.properties.platform_code ? t('search.platform', { code: stop.properties.platform_code }) : undefined}
                                    metroLines={stop.properties.metro_lines}
                                    lines={stop.properties.lines}
                                    highlight={favoriteStops.includes(stop.properties.stop_id)}
                                    testId={`search-item-fav-stop-${stop.properties.stop_id}`}
                                    onClick={() => onStopSelect(stop)}
                                />
                            ))}
                        </CommandGroup>
                    </>
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
                        {results.map((stop) => (
                            <SearchItem
                                key={stop.properties.stop_id}
                                icon={favoriteStops.includes(stop.properties.stop_id) ? <Star size={16} fill="currentColor" strokeWidth={1.5} /> : <MapPin size={16} strokeWidth={1.5} />}
                                title={stop.properties.stop_name}
                                subtitle={stop.properties.platform_code ? t('search.platform', { code: stop.properties.platform_code }) : undefined}
                                metroLines={stop.properties.metro_lines}
                                lines={stop.properties.lines}
                                highlight={favoriteStops.includes(stop.properties.stop_id)}
                                testId={`search-item-res-stop-${stop.properties.stop_id}`}
                                onClick={() => onStopSelect(stop)}
                            />
                        ))}
                    </CommandGroup>
                )}

                {/* Geocoding / places */}
                {geocodingResults.length > 0 && (
                    <>
                        <CommandSeparator />
                        <CommandGroup
                            heading={
                                <div className="flex gap-1.5 items-center">
                                    <Building2 size={12} className="text-muted-foreground -mt-[1px]" strokeWidth={1.5} />
                                    <span className="leading-none">{t('search.places')}</span>
                                </div>
                            }
                            className="[&_[cmdk-group-heading]]:bg-muted/50 [&_[cmdk-group-heading]]:border-b [&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest p-0"
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
                    </>
                )}
            </CommandList>
        </Command>
        </div>
    );
};

SearchDropdown.displayName = 'SearchDropdown';
