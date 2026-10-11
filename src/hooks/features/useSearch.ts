import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { useStopSearch } from '@/hooks/derived/useStopSearch';
import { usePosSearch } from '@/hooks/derived/usePosSearch';
import { useGeocoding, useRememberedPlace, type GeocodingResult } from '@/hooks/data/useGeocoding';
import { useStops } from '@/hooks/data/useStops';
import { useVehicles } from '@/hooks/data/useVehicles';
import { useRouteMetadata } from '@/hooks/data/useRouteMetadata';
import { useHistorySelect } from '@/hooks/features/useHistorySelect';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useViewportStore } from '@/state/viewportStore';
import { useMapMetadataStore } from '@/state/mapMetadataStore';
import { useGeolocationStore } from '@/state/geolocationStore';
import { useSelectionStore } from '@/state/selectionStore';
import { knownLineMetadata, parseLineQuery } from '@/domain/routes';
import { searchStops, stopHistoryEntry, stopsByIds } from '@/domain/stops';
import { searchVehicles } from '@/domain/vehicles';
import type { PosSearchResult } from '@/domain/pointsOfSale';
import { MAP_CAMERA } from '@/config/constants';
import type { SearchHistoryItem, StopFeature, VehicleFeature } from '@/types';

/** What a pick did: opened a panel for it, or changed the map (a line filter or a place pin). */
export type SearchPick = 'panel' | 'map';

/**
 * The search box's state and results, and what picking each kind of result does.
 * `onPicked` hears every pick, after the search text is set to what the box should keep.
 */
export const useSearch = (isOpen: boolean, onPicked: (pick: SearchPick) => void) => {
    const { t } = useTranslation();
    const favoriteStops = usePreferencesStore(s => s.favoriteStops);
    const searchHistory = usePreferencesStore(s => s.searchHistory);
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { addToHistory } = usePreferencesStore(s => s.actions);

    const activeFilter = useViewportStore(s => s.routeFilter);
    const selectedPlaceId = useViewportStore(s => s.selectedPlaceId);
    const { setRouteFilter, setSelectedPlaceId } = useViewportStore(s => s.actions);
    const selectedPlace = useRememberedPlace(selectedPlaceId);

    const flyTo = useMapMetadataStore(s => s.actions.flyTo);
    const userLocation = useGeolocationStore(s => s.userLocation);
    const setIsFollowing = useSelectionStore(s => s.actions.setIsFollowing);

    const stops = useStops();
    const { query, setQuery, results: stopResults, searchIndex } = useStopSearch(stops?.allFeatures || null);
    const geocodingResults = useGeocoding(query, userLocation);
    const posResults = usePosSearch(query, isOpen);

    const favoriteStopFeatures = useMemo(() => {
        if (!stops?.stopIndex || favoriteStops.length === 0) return [];
        return stopsByIds(stops.stopIndex, favoriteStops);
    }, [stops, favoriteStops]);

    const { byName: routesByName } = useRouteMetadata();
    const lineMetadataMap = useMemo(() => knownLineMetadata(stops.allFeatures?.features || [], routesByName), [stops.allFeatures, routesByName]);
    const queryLines = useMemo(() => parseLineQuery(query, lineMetadataMap), [query, lineMetadataMap]);

    const { networkVehicles } = useVehicles();
    const vehicleResults = useMemo(() => searchVehicles(query, networkVehicles), [query, networkVehicles]);

    const lineFilterLabel = activeFilter ? t('search.lineFilter', { line: activeFilter.join(', '), count: activeFilter.length }) : null;

    const flyToResult = (center: [number, number]) => flyTo({ center, zoom: MAP_CAMERA.STOP_SELECT_ZOOM, duration: MAP_CAMERA.FLY_MS });

    // A new pick replaces the pinned place, unless it is a place itself or only filters lines.
    const finish = (pick: SearchPick, keep = '', keepsPlace = false) => {
        if (!keepsPlace && selectedPlaceId) setSelectedPlaceId(null);
        setQuery(keep);
        onPicked(pick);
    };

    const selectStop = (stop: StopFeature) => {
        flyToResult(stop.geometry.coordinates as [number, number]);
        navigate(paths.stop(selectedCity, stop.properties.stop_id));
        addToHistory(stopHistoryEntry(stop, selectedCity));
        finish('panel');
    };

    const selectHistoryItem = useHistorySelect();
    const selectHistory = (item: SearchHistoryItem) => {
        const keep = selectHistoryItem(item);
        const onMap = item.type === 'line' || item.type === 'place';
        finish(onMap ? 'map' : 'panel', keep, onMap);
    };

    const selectLine = (lines: string[]) => {
        setRouteFilter(lines);
        addToHistory({ type: 'line', city_slug: selectedCity, lines });
        finish('map', '', true);
    };

    const selectVehicle = (vehicle: VehicleFeature) => {
        const { gtfs_trip_id, vehicle_id } = vehicle.properties;
        setIsFollowing(true);
        navigate(paths.trip(selectedCity, gtfs_trip_id, vehicle_id));
        finish('panel');
    };

    const selectPos = ({ pos }: PosSearchResult) => {
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
        finish('panel');
    };

    const selectPlace = (result: GeocodingResult) => {
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
        finish('map', result.name, true);
    };

    /**
     * The pick the Enter key makes: a line filter for a line number, else the best stop, else a vehicle.
     * Stops are searched afresh because the shown results can still belong to the text before the last keystroke.
     */
    const selectTopResult = () => {
        if (queryLines) return selectLine(queryLines);
        const topStop = query ? searchStops(searchIndex, query)[0] : undefined;
        if (topStop) return selectStop(topStop);
        if (vehicleResults[0]) selectVehicle(vehicleResults[0]);
    };

    /** Drops the line filter and the place pin, and empties the box. */
    const clearSelection = () => {
        if (activeFilter) setRouteFilter(null);
        if (selectedPlaceId) setSelectedPlaceId(null);
        setQuery('');
    };

    return {
        query, setQuery,
        stopResults, favoriteStopFeatures, favoriteStops, searchHistory,
        vehicleResults, posResults, geocodingResults, queryLines, lineMetadataMap,
        activeFilter, lineFilterLabel, selectedPlace, selectedPlaceId,
        selectStop, selectHistory, selectLine, selectVehicle, selectPos, selectPlace, selectTopResult,
        clearSelection, setRouteFilter, setSelectedPlaceId,
    };
};
