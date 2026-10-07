import React, { useEffect, useRef, useMemo, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, X } from 'lucide-react';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { useStopSearch } from '@/hooks/derived/useStopSearch';
import { usePosSearch } from '@/hooks/derived/usePosSearch';
import { useGeocoding, useRememberedPlace, rememberPlace, type GeocodingResult } from '@/hooks/data/useGeocoding';
import { useRouteParams } from '@/hooks/useRouteParams';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useViewportStore } from '@/state/viewportStore';
import { useMapMetadataStore } from '@/state/mapMetadataStore';
import { useGeolocationStore } from '@/state/geolocationStore';
import { MAP_CAMERA } from '@/config/constants';
import { useStops } from '@/hooks/data/useStops';
import { useVehicles } from '@/hooks/data/useVehicles';
import { useRouteMetadata } from '@/hooks/data/useRouteMetadata';
import type { StopFeature, SearchHistoryItem, VehicleFeature } from '@/types';
import type { PosSearchResult } from '@/domain/pointsOfSale';
import { cn } from 'cn';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { SearchDropdown } from './SearchDropdown';
import { CitySwitcher } from '@/components/Map/CitySwitcher';
import { knownLineMetadata, parseLineQuery } from '@/domain/routes';
import { stopHistoryEntry, stopsByIds } from '@/domain/stops';
import { searchVehicles } from '@/domain/vehicles';
import { useSelectionStore } from '@/state/selectionStore';

/**
 * Container that manages search state, keyboard shortcuts, and click-outside behavior.
 * Visual rendering of results is delegated to SearchDropdown and SearchItem.
 */
export const Search = memo(() => {
    const { t } = useTranslation();

    const { stopId: selectedStopId, vehicleId: selectedVehicleId, isStatsRoute, isFavoritesRoute } = useRouteParams();

    const favoriteStops = usePreferencesStore(s => s.favoriteStops);
    const searchHistory = usePreferencesStore(s => s.searchHistory);
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { addToHistory } = usePreferencesStore(s => s.actions);

    const activeFilter = useViewportStore(s => s.routeFilter);
    const setSelectedPlaceId = useViewportStore(s => s.actions.setSelectedPlaceId);
    const selectedPlaceId = useViewportStore(s => s.selectedPlaceId);
    const selectedPlace = useRememberedPlace(selectedPlaceId);
    const { setRouteFilter: onLineSelect } = useViewportStore(s => s.actions);

    const flyTo = useMapMetadataStore(s => s.actions.flyTo);
    const userLocation = useGeolocationStore(s => s.userLocation);

    const stops = useStops();

    const isSidebarOpen = !!selectedStopId || !!selectedVehicleId || isStatsRoute || isFavoritesRoute;
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const { query, setQuery, results: searchResults } = useStopSearch(stops?.allFeatures || null);
    const geocodingResults = useGeocoding(query, userLocation);
    const posResults = usePosSearch(query, isOpen);


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

    const favoriteStopFeatures = useMemo(() => {
        if (!stops?.stopIndex || favoriteStops.length === 0) return [];
        return stopsByIds(stops.stopIndex, favoriteStops);
    }, [stops, favoriteStops]);

    const results = query === '' && !activeFilter ? favoriteStopFeatures : searchResults;

    const { byName: routesByName } = useRouteMetadata();
    const lineMetadataMap = useMemo(() => knownLineMetadata(stops.allFeatures?.features || [], routesByName), [stops.allFeatures, routesByName]);

    const queryLines = useMemo(() => parseLineQuery(query, lineMetadataMap), [query, lineMetadataMap]);

    const { networkVehicles } = useVehicles();
    const vehicleResults = useMemo(() => searchVehicles(query, networkVehicles), [query, networkVehicles]);
    const setIsFollowing = useSelectionStore(s => s.actions.setIsFollowing);

    const showDropdown = (results.length > 0 || vehicleResults.length > 0 || posResults.length > 0 || geocodingResults.length > 0 || !!queryLines || (query === '' && !activeFilter && searchHistory.length > 0)) && query !== selectedPlace?.name;

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

    const flyToResult = (center: [number, number]) => flyTo({ center, zoom: MAP_CAMERA.STOP_SELECT_ZOOM, duration: MAP_CAMERA.FLY_MS });

    const closeWithQuery = (value = '') => {
        setQuery(value);
        setIsOpen(false);
    };

    const handleStopSelect = (stop: StopFeature) => {
        flyToResult(stop.geometry.coordinates as [number, number]);
        navigate(paths.stop(selectedCity, stop.properties.stop_id));
        addToHistory(stopHistoryEntry(stop, selectedCity));
        closeWithQuery();
    };

    const handleHistorySelect = (item: SearchHistoryItem) => {
        const targetCity = item.city_slug || selectedCity;
        if (item.type === 'place') {
            navigate(paths.city(targetCity));
            flyToResult(item.coordinates);
            rememberPlace({ id: item.place_id, name: item.name, subtitle: item.subtitle || '', coordinates: item.coordinates });
            setSelectedPlaceId(item.place_id);
            closeWithQuery(item.name);
            return;
        }
        if (item.type === 'line') {
            onLineSelect(item.lines);
        } else {
            flyToResult(item.coordinates);
            navigate(item.type === 'stop' ? paths.stop(targetCity, item.stop_id) : paths.pos(targetCity, item.pos_id));
        }
        addToHistory(item);
        closeWithQuery();
    };

    const handleLineSelect = (lines: string[]) => {
        onLineSelect(lines);
        addToHistory({ type: 'line', city_slug: selectedCity, lines });
        closeWithQuery();
    };

    const handleVehicleSelect = (vehicle: VehicleFeature) => {
        const { gtfs_trip_id, vehicle_id } = vehicle.properties;
        setIsFollowing(true);
        navigate(paths.trip(selectedCity, gtfs_trip_id, vehicle_id));
        closeWithQuery();
    };

    const handlePosSelect = ({ pos }: PosSearchResult) => {
        flyToResult([pos.lon, pos.lat]);
        navigate(paths.pos(selectedCity, pos.id));
        addToHistory({
            type: 'pos',
            city_slug: selectedCity,
            pos_id: pos.id,
            name: pos.name,
            subtitle: t(`pos.types.${pos.type}`, pos.type),
            coordinates: [pos.lon, pos.lat],
        });
        closeWithQuery();
    };

    const handlePlaceSelect = (result: GeocodingResult) => {
        navigate(paths.city(selectedCity));
        flyToResult(result.coordinates);
        setSelectedPlaceId(result.id);
        addToHistory({
            type: 'place',
            city_slug: selectedCity,
            place_id: result.id,
            name: result.name,
            subtitle: result.subtitle,
            coordinates: result.coordinates,
        });
        closeWithQuery(result.name);
    };

    return (
        <div
            className={cn(
                "fixed top-0 left-0 w-[calc(100%-56px)] md:w-105 md:left-1/2 md:-translate-x-1/2 safe-top p-4 md:p-0 md:top-5 z-1000 transition-[left,width] duration-300 ease-in-out",
                isSidebarOpen && "md:left-(--visible-center-x) md:w-90"
            )}
        >
            <Autocomplete.Root
                inline
                mode="none"
                autoHighlight
                open={isOpen && showDropdown}
                onOpenChange={(open, details) => {
                    if (!open && details.reason !== 'item-press') setIsOpen(false);
                }}
                value={activeFilter ? t('search.lineFilter', { line: activeFilter.join(', '), count: activeFilter.length }) : query}
                onValueChange={(value, details) => {
                    if (details.reason !== 'input-change' && details.reason !== 'input-clear') return;
                    if (activeFilter) {
                        onLineSelect(null);
                        setQuery('');
                    } else {
                        setQuery(value);
                    }
                    if (selectedPlaceId) {
                        setSelectedPlaceId(null);
                    }
                    setIsOpen(true);
                }}
            >
                <div ref={containerRef}>
                    <div 
                        className="flex h-11 glassy rounded-2xl overflow-hidden transition-colors items-center focus-within:ring-2 focus-within:ring-primary/20 shadow-sm" 
                        data-testid="search-container"
                    >
                        <CitySwitcher variant="ghost" className="w-12 pl-1 rounded-l-2xl rounded-r-none border-r border-border/40 hover:bg-muted/50" />
                    
                        <div className="relative flex-1 group h-full" onClick={() => inputRef.current?.focus()}>
                            <Autocomplete.Input
                                ref={inputRef}
                                render={<Input />}
                                aria-label={t('search.placeholder')}
                                onFocus={() => setIsOpen(true)}
                                placeholder={t('search.placeholder')}
                                className={cn(
                                    "h-full w-full bg-transparent border-0! pl-10 text-[15px] truncate placeholder:text-sm placeholder:text-muted-foreground/50 focus-visible:ring-0! focus-visible:border-transparent! shadow-none! rounded-none outline-none",
                                    activeFilter && "text-primary font-medium"
                                )}
                                data-testid="search-input"
                                readOnly={!!activeFilter}
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none">
                                <SearchIcon size={18} strokeWidth={2} className={cn(activeFilter && "text-primary")}  />
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
                                        className="h-9 w-9 text-muted-foreground hover:bg-muted/50"
                                        aria-label={t('search.clearFilter')}
                                    >
                                        <X size={18} strokeWidth={2}  />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {isOpen && showDropdown && (
                        <SearchDropdown
                            results={results}
                            searchHistory={searchHistory}
                            favoriteStops={favoriteStops}
                            query={query}
                            activeFilter={activeFilter}
                            queryLines={queryLines}
                            vehicleResults={vehicleResults}
                            geocodingResults={geocodingResults}
                            posResults={posResults}
                            onStopSelect={handleStopSelect}
                            onHistorySelect={handleHistorySelect}
                            onLineSelect={handleLineSelect}
                            onPlaceSelect={handlePlaceSelect}
                            onPosSelect={handlePosSelect}
                            onVehicleSelect={handleVehicleSelect}
                            lineMetadataMap={lineMetadataMap}
                        />
                    )}
                </div>
            </Autocomplete.Root>
        </div>
    );
});

Search.displayName = 'Search';
