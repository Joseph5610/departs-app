import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, X } from 'lucide-react';
import { navigate } from '../../../lib/history';
import { paths } from '../../../lib/routes';
import { useStopSearch } from '../../../hooks/features/useStopSearch';
import { usePosSearch } from '../../../hooks/features/usePosSearch';
import { useGeocoding, useRememberedPlace, rememberPlace } from '../../../hooks/data/useGeocoding';
import { useRouteParams } from '../../../hooks/useRouteParams';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { useViewportStore } from '../../../state/viewportStore';
import { useMapMetadataStore } from '../../../state/mapMetadataStore';
import { useGeolocationStore } from '../../../state/geolocationStore';
import { MAP_CAMERA } from '../../../config/constants';
import { useStops } from '../../../hooks/data/useStops';
import { useVehicles } from '../../../hooks/data/useVehicles';
import { useRouteMetadata } from '../../../hooks/data/useRouteMetadata';
import type { StopFeature, SearchHistoryItem } from '../../../types/transit';
import type { GeocodingResult } from '../../../hooks/data/useGeocoding';
import type { PosSearchResult } from '../../../utils/posSearch';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchDropdown } from './SearchDropdown';
import { CitySwitcher } from '../CitySwitcher';
import { getLineMetadataMap } from '@/utils/transitUtils';
import { parseLineQuery } from '@/utils/lineSearch';
import { searchVehicles } from '@/utils/vehicleSearch';
import { useSelectionStore } from '../../../state/selectionStore';
import type { VehicleFeature } from '../../../types/transit';

/**
 * Search Component
 *
 * Container that manages search state, keyboard shortcuts, and click-outside behavior.
 * Visual rendering of results is delegated to SearchDropdown and SearchItem.
 */
export const Search: React.FC = React.memo(() => {
    const { t } = useTranslation();

    // Zustand state
    const { stopId: selectedStopId, vehicleId: selectedVehicleId, isStatsRoute, isFavoritesRoute } = useRouteParams();

    // Preferences
    const favoriteStops = usePreferencesStore(s => s.favoriteStops);
    const searchHistory = usePreferencesStore(s => s.searchHistory);
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { addToHistory } = usePreferencesStore(s => s.actions);

    // Viewport
    const activeFilter = useViewportStore(s => s.routeFilter);
    const setSelectedPlaceId = useViewportStore(s => s.actions.setSelectedPlaceId);
    const selectedPlaceId = useViewportStore(s => s.selectedPlaceId);
    const selectedPlace = useRememberedPlace(selectedPlaceId);
    const { setRouteFilter: onLineSelect } = useViewportStore(s => s.actions);

    // Metadata & Geolocation
    const flyTo = useMapMetadataStore(s => s.actions.flyTo);
    const userLocation = useGeolocationStore(s => s.userLocation);

    const stops = useStops();

    const isSidebarOpen = !!selectedStopId || !!selectedVehicleId || isStatsRoute || isFavoritesRoute;
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const { query, setQuery, results: searchResults } = useStopSearch(stops?.allFeatures || null);
    const { results: geocodingResults } = useGeocoding(query, userLocation);
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

    const favoriteStopFeatures = React.useMemo(() => {
        if (!stops?.stopIndex || favoriteStops.length === 0) return [];
        return favoriteStops.map(id => stops.stopIndex.get(id)).filter((s): s is StopFeature => s !== undefined);
    }, [stops, favoriteStops]);

    const results = query === '' && !activeFilter ? favoriteStopFeatures : searchResults;

    const { byName: routesByName } = useRouteMetadata();
    const lineMetadataMap = React.useMemo(() => {
        const map = getLineMetadataMap(stops.allFeatures?.features || []);
        for (const [name, route] of routesByName) {
            if (!map.has(name)) map.set(name, { route_color: route.route_color, type: route.type });
        }
        return map;
    }, [stops.allFeatures, routesByName]);

    const queryLines = React.useMemo(() => parseLineQuery(query, lineMetadataMap), [query, lineMetadataMap]);

    const { networkVehicles } = useVehicles();
    const vehicleResults = React.useMemo(() => searchVehicles(query, networkVehicles), [query, networkVehicles]);
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

    const handleStopSelect = (stop: StopFeature) => {
        const [lng, lat] = stop.geometry.coordinates;
        flyTo({
            center: [lng, lat],
            zoom: MAP_CAMERA.STOP_SELECT_ZOOM,
            duration: MAP_CAMERA.FLY_MS
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

        navigate(paths.stop(selectedCity, selectedStop.stop_id));
        addToHistory({
            type: 'stop',
            city_slug: selectedCity,
            ...selectedStop
        });
        setQuery('');
        setIsOpen(false);
    };

    const handleHistorySelect = (item: SearchHistoryItem) => {
        const targetCity = item.city_slug || selectedCity;
        if (item.type === 'stop') {
            flyTo({
                center: item.coordinates,
                zoom: MAP_CAMERA.STOP_SELECT_ZOOM,
                duration: MAP_CAMERA.FLY_MS
            });
            navigate(paths.stop(targetCity, item.stop_id));
            addToHistory(item);
        } else if (item.type === 'pos') {
            flyTo({
                center: item.coordinates,
                zoom: MAP_CAMERA.STOP_SELECT_ZOOM,
                duration: MAP_CAMERA.FLY_MS
            });
            navigate(paths.pos(targetCity, item.pos_id));
            addToHistory(item);
        } else if (item.type === 'place') {
            navigate(paths.city(targetCity));
            flyTo({
                center: item.coordinates,
                zoom: MAP_CAMERA.STOP_SELECT_ZOOM,
                duration: MAP_CAMERA.FLY_MS
            });
            rememberPlace({
                id: item.place_id,
                name: item.name,
                subtitle: item.subtitle || '',
                coordinates: item.coordinates
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
        addToHistory({ type: 'line', city_slug: selectedCity, lines });
        setQuery('');
        setIsOpen(false);
    };

    const handleVehicleSelect = (vehicle: VehicleFeature) => {
        const { gtfs_trip_id, vehicle_id } = vehicle.properties;
        setIsFollowing(true);
        navigate(paths.trip(selectedCity, gtfs_trip_id, vehicle_id));
        setQuery('');
        setIsOpen(false);
    };

    const handlePosSelect = (result: PosSearchResult) => {
        const { pos } = result;
        flyTo({
            center: [pos.lon, pos.lat],
            zoom: MAP_CAMERA.STOP_SELECT_ZOOM,
            duration: MAP_CAMERA.FLY_MS
        });
        navigate(paths.pos(selectedCity, pos.id));
        addToHistory({
            type: 'pos',
            city_slug: selectedCity,
            pos_id: pos.id,
            name: pos.name,
            subtitle: t(`pos.types.${pos.type}`, pos.type),
            coordinates: [pos.lon, pos.lat]
        });
        setQuery('');
        setIsOpen(false);
    };

    const handlePlaceSelect = (result: GeocodingResult) => {
        navigate(paths.city(selectedCity));
        flyTo({
            center: result.coordinates,
            zoom: MAP_CAMERA.STOP_SELECT_ZOOM,
            duration: MAP_CAMERA.FLY_MS
        });
        setSelectedPlaceId(result.id);
        addToHistory({
            type: 'place',
            city_slug: selectedCity,
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
                "fixed top-0 left-0 w-[calc(100%-56px)] md:w-105 md:left-1/2 md:-translate-x-1/2 safe-top p-4 md:p-0 md:top-5 z-50 transition-[left,width] duration-300 ease-in-out",
                isSidebarOpen && "md:left-(--visible-center-x) md:w-90"
            )}
            data-vaul-no-drag
        >
            <div ref={containerRef}>
                <div 
                    className="flex h-11 glassy rounded-2xl overflow-hidden transition-colors items-center focus-within:ring-2 focus-within:ring-primary/20 shadow-sm" 
                    data-testid="search-container"
                >
                    <CitySwitcher variant="ghost" className="w-12 pl-1 rounded-l-2xl rounded-r-none border-r border-border/40 hover:bg-muted/50" />
                    
                    <div className="relative flex-1 group h-full" onClick={() => inputRef.current?.focus()}>
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
                                if (e.key !== 'Enter') return;
                                if (vehicleResults.length > 0) {
                                    handleVehicleSelect(vehicleResults[0]);
                                } else if (results.length > 0) {
                                    handleStopSelect(results[0]);
                                } else if (queryLines) {
                                    handleLineSelect(queryLines);
                                }
                            }}
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
        </div>
    );
});

Search.displayName = 'Search';
