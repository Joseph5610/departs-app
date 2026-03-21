
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, X, MapPin, Star, Clock } from 'lucide-react';
import { useStopSearch } from '../hooks/useStopSearch';
import { useMap } from '../hooks/useMap';
import { MAP_STOP_SELECT_ZOOM, MAP_FLY_DURATION } from '../config/constants';
import { useStops } from '../hooks/useStops';
import type { StopFeature } from '../types/transit';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Overlay, Surface, Stack, HStack, Box } from '@/components/ui/layout';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';

/**
 * Search Component
 *
 * Re-architected for "className-free" JSX using semantic layout components.
 */
export const Search: React.FC = React.memo(() => {
    const { t } = useTranslation();
    const { state, actions, mapRef } = useMap();
    const { data: stops } = useStops();

    const { routeFilter: activeFilter, favoriteStops, searchHistory } = state;
    const { setRouteFilter: onLineSelect, selectStop, addToHistory } = actions;
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
    const showHistory = query === '' && !activeFilter && searchHistory.length > 0;

    const linesFromQuery = React.useMemo(() => {
        return query.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0 && s.length <= 10);
    }, [query]);

    const isLineLike = React.useMemo(() => {
        const trimmed = query.trim();
        if (trimmed.length === 0) return false;
        if (!trimmed.includes(',')) return trimmed.length <= 10 && !trimmed.includes(' ');
        return linesFromQuery.length > 0;
    }, [query, linesFromQuery]);

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
        selectStop(selectedStop);
        addToHistory({
            type: 'stop',
            ...selectedStop,
            coordinates: stop.geometry.coordinates as [number, number]
        });
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
                            "h-11 pl-10 pr-12 rounded-2xl glassy-tinted border-white/15! transition-all placeholder:text-sm focus-visible:border-primary/50 focus-visible:ring-primary/20",
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
                            <Kbd className="bg-white/10 border-white/10 text-white/50 h-5 min-w-5 rounded-md px-1.5 font-bold">
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

                {isOpen && (results.length > 0 || isLineLike || showHistory) && (
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
                                            onClick={() => {
                                                if (item.type === 'stop') {
                                                    mapRef.current?.flyTo({
                                                        center: item.coordinates,
                                                        zoom: MAP_STOP_SELECT_ZOOM,
                                                        duration: MAP_FLY_DURATION
                                                    });
                                                    selectStop({
                                                        stop_id: item.stop_id,
                                                        stop_name: item.stop_name,
                                                        platform_code: item.platform_code,
                                                        coordinates: item.coordinates,
                                                        is_train: item.is_train
                                                    });
                                                    addToHistory(item);
                                                } else {
                                                    onLineSelect(item.lines);
                                                    addToHistory(item);
                                                }
                                                setQuery('');
                                                setIsOpen(false);
                                            }}
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
                                    onClick={() => {
                                        onLineSelect(linesFromQuery);
                                        addToHistory({ type: 'line', lines: linesFromQuery });
                                        setQuery('');
                                        setIsOpen(false);
                                    }}
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
                                    onClick={() => handleStopSelect(stop)}
                                />
                            ))}
                        </Stack>
                    </Surface>
                )}
            </Box>
        </Overlay>
    );
});

const SearchItem = ({ icon, title, subtitle, onClick, variant = 'default', highlight = false, testId }: {
    icon: React.ReactNode,
    title: string,
    subtitle?: string,
    onClick: () => void,
    variant?: 'default' | 'primary',
    highlight?: boolean,
    testId?: string
}) => (
    <Surface
        asChild
        variant="ghost"
        className={cn(
            "w-full px-4 py-3 flex flex-row items-center gap-3 transition-colors text-left outline-none focus-visible:bg-white/10 rounded-none",
            variant === 'primary' ? "hover:bg-primary/10 active:bg-primary/20" : "hover:bg-white/10 active:bg-white/15"
        )}
    >
        <button 
            onClick={onClick}
            data-testid={testId}
        >
            <Box center padding="sm" className={cn(
                "rounded-lg shrink-0",
                variant === 'primary' ? "bg-primary/10 text-primary" :
                highlight ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"
            )}>
                {icon}
            </Box>
            <Stack gap={0} className="min-w-0">
                <span className="text-foreground font-medium truncate">{title}</span>
                {subtitle && <span className="text-muted-foreground text-xs truncate">{subtitle}</span>}
            </Stack>
        </button>
    </Surface>
);

Search.displayName = 'Search';
