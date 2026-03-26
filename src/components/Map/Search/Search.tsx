
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, X } from 'lucide-react';
import { useStopSearch } from '../../../hooks/features/useStopSearch';
import { useSelection, usePreferences, useViewport } from '../../../state/MapStateProvider';
import { MAP_STOP_SELECT_ZOOM, MAP_FLY_DURATION } from '../../../config/constants';
import { useStops } from '../../../hooks/data/useStops';
import type { StopFeature, SearchHistoryItem } from '../../../types/transit';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Overlay, Box } from '@/components/ui/layout';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { SearchDropdown } from './SearchDropdown';

/**
 * Search Component
 *
 * Container that manages search state, keyboard shortcuts, and click-outside behavior.
 * Visual rendering of results is delegated to SearchDropdown and SearchItem.
 */
export const Search: React.FC = React.memo(() => {
    const { t } = useTranslation();
    const { actions: selActions } = useSelection();
    const { state: prefState, actions: prefActions } = usePreferences();
    const { state: vpState, actions: vpActions, mapRef } = useViewport();
    const { data: stops } = useStops();

    const { favoriteStops, searchHistory } = prefState;
    const { routeFilter: activeFilter } = vpState;
    const { addToHistory } = prefActions;
    const { selectStop } = selActions;
    const { setRouteFilter: onLineSelect } = vpActions;
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const { query, setQuery, results: searchResults } = useStopSearch(stops || null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '/' &&
                document.activeElement?.tagName !== 'INPUT' &&
                document.activeElement?.tagName !== 'TEXTAREA' &&
                !document.querySelector('[role="dialog"]')
            ) {
                e.preventDefault();
                inputRef.current?.focus();
                setIsOpen(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const favoriteStopFeatures = React.useMemo(() => {
        if (!stops?.features || favoriteStops.length === 0) return [];
        return stops.features.filter(s => favoriteStops.includes(s.properties.stop_id));
    }, [stops, favoriteStops]);

    const results = query === '' && !activeFilter ? favoriteStopFeatures : searchResults;

    const linesFromQuery = React.useMemo(() =>
        query.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0 && s.length <= 10),
    [query]);

    const isLineLike = React.useMemo(() => {
        const trimmed = query.trim();
        if (trimmed.length === 0) return false;
        if (!trimmed.includes(',')) return trimmed.length <= 10 && !trimmed.includes(' ');
        return linesFromQuery.length > 0;
    }, [query, linesFromQuery]);

    const showDropdown = results.length > 0 || isLineLike || (query === '' && !activeFilter && searchHistory.length > 0);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const clearSearch = (e?: React.MouseEvent) => {
        e?.preventDefault();
        e?.stopPropagation();
        if (activeFilter) onLineSelect(null);
        setQuery('');
    };

    const handleStopSelect = (stop: StopFeature) => {
        const [lng, lat] = stop.geometry.coordinates;
        mapRef.current?.flyTo({
            center: [lng, lat],
            zoom: MAP_STOP_SELECT_ZOOM,
            duration: MAP_FLY_DURATION
        });
        const selectedStop = {
            stop_id: stop.properties.stop_id,
            stop_name: stop.properties.stop_name,
            platform_code: stop.properties.platform_code,
            is_train: stop.properties.is_train === 1,
            coordinates: stop.geometry.coordinates as [number, number]
        };
        selectStop(selectedStop.stop_id);
        addToHistory({
            type: 'stop',
            ...selectedStop
        });
        setQuery('');
        setIsOpen(false);
    };

    const handleHistorySelect = (item: SearchHistoryItem) => {
        if (item.type === 'stop') {
            mapRef.current?.flyTo({
                center: item.coordinates,
                zoom: MAP_STOP_SELECT_ZOOM,
                duration: MAP_FLY_DURATION
            });
            selectStop(item.stop_id);
            addToHistory(item);
        } else {
            onLineSelect(item.lines);
            addToHistory(item);
        }
        setQuery('');
        setIsOpen(false);
    };

    const handleLineSelect = (lines: string[]) => {
        onLineSelect(lines);
        addToHistory({ type: 'line', lines });
        setQuery('');
        setIsOpen(false);
    };

    return (
        <Overlay
            position="top-left"
            className="w-[calc(100%-80px)] md:w-[420px] md:left-1/2 md:-translate-x-1/2 safe-top p-4 md:pt-5 z-[2000]"
            data-vaul-no-drag
        >
            <Box ref={containerRef}>
                <div className="relative group">
                    <Input
                        ref={inputRef}
                        aria-label={t('search.placeholder')}
                        value={activeFilter ? t('search.lineFilter', { line: activeFilter.join(', ') }) : query}
                        onChange={(e) => {
                            if (activeFilter) {
                                onLineSelect(null);
                                setQuery('');
                            } else {
                                setQuery(e.target.value);
                            }
                            setIsOpen(true);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && results.length > 0) {
                                handleStopSelect(results[0]);
                            }
                        }}
                        onFocus={() => setIsOpen(true)}
                        placeholder={t('search.placeholder')}
                        className={cn(
                            "h-11 pl-10 pr-12 rounded-2xl glassy-tinted transition-all placeholder:text-sm focus-visible:border-primary/50 focus-visible:ring-primary/20",
                            activeFilter && "border-primary/50 ring-1 ring-primary/20"
                        )}
                        data-testid="search-input"
                        readOnly={!!activeFilter}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                        <SearchIcon size={20} className={cn(activeFilter && "text-primary")} />
                    </div>
                    {!query && !activeFilter && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                            <Kbd className="bg-white/10 border-white/10 text-white/50 px-1.5 font-bold">
                                /
                            </Kbd>
                        </div>
                    )}
                    {(query || activeFilter) && (
                        <div className="absolute right-0 top-0 h-full flex items-center pr-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={clearSearch}
                                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                                aria-label={t('search.clearFilter')}
                            >
                                <X size={20} />
                            </Button>
                        </div>
                    )}
                </div>

                {isOpen && showDropdown && (
                    <SearchDropdown
                        results={results}
                        searchHistory={searchHistory}
                        favoriteStops={favoriteStops}
                        query={query}
                        activeFilter={activeFilter}
                        isLineLike={isLineLike}
                        linesFromQuery={linesFromQuery}
                        onStopSelect={handleStopSelect}
                        onHistorySelect={handleHistorySelect}
                        onLineSelect={handleLineSelect}
                    />
                )}
            </Box>
        </Overlay>
    );
});

Search.displayName = 'Search';
