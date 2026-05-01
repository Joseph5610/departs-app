import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, MapPin, Star, Clock, Building2 } from 'lucide-react';
import { Box, Stack, HStack, Surface } from '@/components/ui/layout';
import { SearchItem } from './SearchItem';
import { METRO_STATIONS } from '@/config/stations';
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
}

/**
 * SearchDropdown
 *
 * Renders the dropdown panel below the search input.
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
    onPlaceSelect
}) => {
    const { t } = useTranslation();

    const showHistory = query === '' && !activeFilter && searchHistory.length > 0;

    return (
        <Surface variant="tinted" className="mt-2 overflow-hidden max-h-[60vh] overflow-y-auto rounded-2xl">
            <Stack gap={0}>
                {showHistory && (
                    <>
                        <Box className="px-4 py-2 bg-white/5">
                            <HStack className="gap-2">
                                <Clock size={10} className="text-muted-foreground" />
                                <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest">
                                    {t('search.recent')}
                                </span>
                            </HStack>
                        </Box>
                        {searchHistory.map((item) => (
                            <SearchItem
                                key={
                                    item.type === 'stop' ? `hist-stop-${item.stop_id}` :
                                    item.type === 'place' ? `hist-place-${item.place_id}` :
                                    `hist-line-${item.lines.join('-')}`
                                }
                                icon={
                                    item.type === 'stop' ? <MapPin size={16} /> :
                                    item.type === 'place' ? <Building2 size={16} /> :
                                    <SearchIcon size={16} />
                                }
                                title={
                                    item.type === 'stop' ? item.stop_name :
                                    item.type === 'place' ? item.name :
                                    t('search.lineFilter', { line: item.lines.join(', ') })
                                }
                                subtitle={
                                    item.type === 'stop' && item.platform_code ? t('search.platform', { code: item.platform_code }) :
                                    item.type === 'place' ? item.subtitle :
                                    undefined
                                }
                                metroLines={item.type === 'stop' ? METRO_STATIONS[item.stop_name] : undefined}
                                testId={
                                    item.type === 'stop' ? `search-item-stop-${item.stop_name}` :
                                    item.type === 'place' ? `search-item-place-${item.place_id}` :
                                    `search-item-line-${item.lines.join('-')}`
                                }
                                onClick={() => onHistorySelect(item)}
                            />
                        ))}
                    </>
                )}

                {query === '' && results.length > 0 && (
                    <Box className="px-4 py-2 bg-white/5">
                        <HStack className="gap-2">
                            <Star size={10} fill="currentColor" className="text-muted-foreground" />
                            <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest">
                                {t('search.favorites')}
                            </span>
                        </HStack>
                    </Box>
                )}

                {isLineLike && (
                    <SearchItem
                        icon={<SearchIcon size={16} />}
                        title={t('search.lineFilter', { line: linesFromQuery.join(', ') })}
                        variant="primary"
                        testId={`search-item-line-${linesFromQuery.join('-')}`}
                        onClick={() => onLineSelect(linesFromQuery)}
                    />
                )}

                {results.map((stop) => (
                    <SearchItem
                        key={stop.properties.stop_id}
                        icon={favoriteStops.includes(stop.properties.stop_id) ? <Star size={16} fill="currentColor" /> : <MapPin size={16} />}
                        title={stop.properties.stop_name}
                        subtitle={stop.properties.platform_code ? t('search.platform', { code: stop.properties.platform_code }) : undefined}
                        metroLines={METRO_STATIONS[stop.properties.stop_name]}
                        highlight={favoriteStops.includes(stop.properties.stop_id)}
                        testId={`search-item-stop-${stop.properties.stop_name}${stop.properties.platform_code ? '-' + stop.properties.platform_code : ''}`}
                        onClick={() => onStopSelect(stop)}
                    />
                ))}

                {geocodingResults.length > 0 && (
                    <>
                        <Box className="px-4 py-2 bg-white/5">
                            <HStack className="gap-2">
                                <Building2 size={10} className="text-muted-foreground" />
                                <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest">
                                    {t('search.places')}
                                </span>
                            </HStack>
                        </Box>
                        {geocodingResults.map((place) => (
                            <SearchItem
                                key={place.id}
                                icon={<Building2 size={16} />}
                                title={place.name}
                                subtitle={place.subtitle || undefined}
                                testId={`search-item-place-${place.id}`}
                                onClick={() => onPlaceSelect(place)}
                            />
                        ))}
                    </>
                )}
            </Stack>
        </Surface>
    );
};

SearchDropdown.displayName = 'SearchDropdown';
