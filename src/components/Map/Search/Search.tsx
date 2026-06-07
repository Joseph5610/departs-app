import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, X } from 'lucide-react';
import { navigate } from 'wouter/use-browser-location';
import { useStopSearch } from '../../../hooks/features/useStopSearch';
import { useGeocoding, geocodingCache } from '../../../hooks/data/useGeocoding';
import { useRouteParams } from '../../../hooks/useRouteParams';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { useViewportStore } from '../../../state/viewportStore';
import { useMapMetadataStore } from '../../../state/mapMetadataStore';
import { useGeolocationStore } from '../../../state/geolocationStore';
import { MAP_STOP_SELECT_ZOOM, MAP_FLY_DURATION } from '../../../config/constants';
import { useStops } from '../../../hooks/data/useStops';
import type { StopFeature, SearchHistoryItem } from '../../../types/transit';
import type { GeocodingResult } from '../../../hooks/data/useGeocoding';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchDropdown } from './SearchDropdown';
import { getLineMetadataMap } from '@/utils/transitUtils';

/**
 * Search Component
 *
 * Container that manages search state, keyboard shortcuts, and click-outside behavior.
 * Visual rendering of results is delegated to SearchDropdown and SearchItem.
 */
export const Search: React.FC = React.memo(() => {
    const { t } = useTranslation();

    // Zustand state
    const { stopId: selectedStopId, vehicleId: selectedVehicleId } = useRouteParams();

    // Preferences
    const favoriteStops = usePreferencesStore(s => s.favoriteStops);
    const searchHistory = usePreferencesStore(s => s.searchHistory);
    const { addToHistory } = usePreferencesStore(s => s.actions);

    // Viewport
    const activeFilter = useViewportStore(s => s.routeFilter);
    const setSelectedPlaceId = useViewportStore(s => s.actions.setSelectedPlaceId);
    const selectedPlaceId = useViewportStore(s => s.selectedPlaceId);
    const selectedPlace = selectedPlaceId ? geocodingCache.get(selectedPlaceId) : null;
    const { setRouteFilter: onLineSelect } = useViewportStore(s => s.actions);

    // Metadata & Geolocation
    const flyTo = useMapMetadataStore(s => s.actions.flyTo);
    const userLocation = useGeolocationStore(s => s.userLocation);

    const stops = useStops();

    const isSidebarOpen = !!selectedStopId || !!selectedVehicleId;
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const { query, setQuery, results: searchResults } = useStopSearch(stops?.allFeatures || null);
    const { results: geocodingResults } = useGeocoding(query, userLocation);

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
        if (!stops?.allFeatures?.features || favoriteStops.length === 0) return [];
        return stops.allFeatures.features.filter((s: StopFeature) => favoriteStops.includes(s.properties.stop_id));
    }, [stops, favoriteStops]);

    const results = query === '' && !activeFilter ? favoriteStopFeatures : searchResults;

    const linesFromQuery = React.useMemo(() =>
        query.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0 && s.length <= 10),
    [query]);

    const lineMetadataMap = React.useMemo(() => 
        getLineMetadataMap(stops.allFeatures?.features || []), 
    [stops.allFeatures]);

    const isLineLike = React.useMemo(() => {
        const trimmed = query.trim().toUpperCase();
        if (trimmed.length === 0) return false;
        
        if (trimmed.includes(',')) {
            return linesFromQuery.length > 0 && linesFromQuery.every(l => 
                lineMetadataMap.has(l) || /^[A-C]|S\d+|R\d+|X[A-Z0-9-]{1,3}|[0-9]{1,3}[A-Z]?|AE|LD|P\d|H\d$/i.test(l)
            );
        }
        
        // Match against map OR check if it looks like a PID line (safety net for cache/sync issues)
        return lineMetadataMap.has(trimmed) || 
               /^([A-C]|S\d{1,2}|R\d{1,2}|X[A-Z0-9-]{1,3}|[0-9]{1,3}[A-Z]?|AE|LD|P\d|H\d|MHD\s?\d{1,2})$/i.test(trimmed);
    }, [query, linesFromQuery, lineMetadataMap]);

    const showDropdown = (results.length > 0 || geocodingResults.length > 0 || isLineLike || (query === '' && !activeFilter && searchHistory.length > 0)) && query !== selectedPlace?.name;

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
        flyTo({
            center: [lng, lat],
            zoom: MAP_STOP_SELECT_ZOOM,
            duration: MAP_FLY_DURATION
        });
        const selectedStop = {
            stop_id: stop.properties.stop_id,
            stop_name: stop.properties.stop_name,
            platform_code: stop.properties.platform_code,
            is_train: stop.properties.is_train === 1 ? 1 : 0,
            metro_lines: stop.properties.metro_lines,
            lines: stop.properties.lines,
            coordinates: stop.geometry.coordinates as [number, number]
        };

        navigate(`/stop/${encodeURIComponent(selectedStop.stop_id)}`);
        addToHistory({
            type: 'stop',
            ...selectedStop
        });
        setQuery('');
        setIsOpen(false);
    };

    const handleHistorySelect = (item: SearchHistoryItem) => {
        if (item.type === 'stop') {
            flyTo({
                center: item.coordinates,
                zoom: MAP_STOP_SELECT_ZOOM,
                duration: MAP_FLY_DURATION
            });
            navigate(`/stop/${encodeURIComponent(item.stop_id)}`);
            addToHistory(item);
        } else if (item.type === 'place') {
            navigate('/');
            flyTo({
                center: item.coordinates,
                zoom: MAP_STOP_SELECT_ZOOM,
                duration: MAP_FLY_DURATION
            });
            setSelectedPlaceId(item.place_id);
            setQuery(item.name);
        } else {
            onLineSelect(item.lines);
            addToHistory(item);
            setQuery('');
        }
        if (item.type !== 'place') setQuery('');
        setIsOpen(false);
    };

    const handleLineSelect = (lines: string[]) => {
        onLineSelect(lines);
        addToHistory({ type: 'line', lines });
        setQuery('');
        setIsOpen(false);
    };

    const handlePlaceSelect = (result: GeocodingResult) => {
        navigate('/');
        flyTo({
            center: result.coordinates,
            zoom: MAP_STOP_SELECT_ZOOM,
            duration: MAP_FLY_DURATION
        });
        setSelectedPlaceId(result.id);
        addToHistory({
            type: 'place',
            place_id: result.id,
            name: result.name,
            subtitle: result.subtitle,
            coordinates: result.coordinates
        });
        setQuery(result.name);
        setIsOpen(false);
    };

    return (
        <div
            className={cn(
                "fixed top-0 left-0 w-[calc(100%-56px)] md:w-[420px] md:left-1/2 md:-translate-x-1/2 safe-top p-4 md:p-0 md:top-5 z-50 transition-all duration-300 ease-in-out",
                isSidebarOpen && "md:left-(--visible-center-x) md:w-[360px]"
            )}
            data-vaul-no-drag
            onClick={() => inputRef.current?.focus()}
        >
            <div ref={containerRef}>
                <div className="relative group">
                    <Input
                        ref={inputRef}
                        aria-label={t('search.placeholder')}
                        value={activeFilter ? t('search.lineFilter', { line: activeFilter.join(', '), count: activeFilter.length }) : query}
                        onChange={(e) => {
                            if (activeFilter) {
                                onLineSelect(null);
                                setQuery('');
                            } else {
                                setQuery(e.target.value);
                            }
                            if (selectedPlaceId) {
                                setSelectedPlaceId(null);
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
                            "h-11 pl-12 pr-4 rounded-2xl glassy transition-all text-[15px] truncate placeholder:text-[14px] placeholder:text-muted-foreground/50 focus-visible:border-primary/50 focus-visible:ring-primary/20",
                            activeFilter && "border-primary/50 ring-1 ring-primary/20"
                        )}
                        data-testid="search-input"
                        readOnly={!!activeFilter}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                        <SearchIcon size={20} strokeWidth={1.5} className={cn(activeFilter && "text-primary")}  />
                    </div>
                    {(query || activeFilter) && (
                        <div className="absolute right-0 top-0 h-full flex items-center pr-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    if (selectedPlaceId) setSelectedPlaceId(null);
                                    clearSearch();
                                    inputRef.current?.focus();
                                }}
                                className="h-9 w-9 text-muted-foreground"
                                aria-label={t('search.clearFilter')}
                            >
                                <X size={20} strokeWidth={1.5}  />
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
                        geocodingResults={geocodingResults}
                        onStopSelect={handleStopSelect}
                        onHistorySelect={handleHistorySelect}
                        onLineSelect={handleLineSelect}
                        onPlaceSelect={handlePlaceSelect}
                        lineMetadataMap={lineMetadataMap}
                    />
                )}
            </div>
        </div>
    );
});

Search.displayName = 'Search';
