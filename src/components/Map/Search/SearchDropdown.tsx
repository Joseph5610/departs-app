import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, MapPin, Star, Clock } from 'lucide-react';
import { Box, Stack, HStack, Surface } from '@/components/ui/layout';
import { SearchItem } from './SearchItem';
import type { StopFeature, SearchHistoryItem } from '../../../types/transit';

interface SearchDropdownProps {
    results: StopFeature[];
    searchHistory: SearchHistoryItem[];
    favoriteStops: string[];
    query: string;
    activeFilter: string[] | null;
    isLineLike: boolean;
    linesFromQuery: string[];
    onStopSelect: (stop: StopFeature) => void;
    onHistorySelect: (item: SearchHistoryItem) => void;
    onLineSelect: (lines: string[]) => void;
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
    onStopSelect,
    onHistorySelect,
    onLineSelect
}) => {
    const { t } = useTranslation();

    const showHistory = query === '' && !activeFilter && searchHistory.length > 0;

    return (
        <Surface variant="tinted" className="mt-2 overflow-hidden max-h-[60vh] overflow-y-auto border-white/15! rounded-2xl">
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
                                key={item.type === 'stop' ? `hist-stop-${item.stop_id}` : `hist-line-${item.lines.join('-')}`}
                                icon={item.type === 'stop' ? <MapPin size={16} /> : <SearchIcon size={16} />}
                                title={item.type === 'stop' ? item.stop_name : t('search.lineFilter', { line: item.lines.join(', ') })}
                                subtitle={item.type === 'stop' && item.platform_code ? t('search.platform', { code: item.platform_code }) : undefined}
                                testId={item.type === 'stop' ? `search-item-stop-${item.stop_name}` : `search-item-line-${item.lines.join('-')}`}
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
                        highlight={favoriteStops.includes(stop.properties.stop_id)}
                        testId={`search-item-stop-${stop.properties.stop_name}${stop.properties.platform_code ? '-' + stop.properties.platform_code : ''}`}
                        onClick={() => onStopSelect(stop)}
                    />
                ))}
            </Stack>
        </Surface>
    );
};

SearchDropdown.displayName = 'SearchDropdown';
