
import { useState, useCallback, useRef } from 'react';
import type { SymbolLayerSpecification, Map as MapLibreMap, MapLibreEvent, LayerSpecification } from 'maplibre-gl';
import type { ViewStateChangeEvent } from 'react-map-gl/maplibre';
import { addAllIcons } from '../utils/mapIcons';
import {
    BOUNDS_DEBOUNCE_MS,
    MAP_MIN_ZOOM_FOR_VEHICLES
} from '../config/constants';

/**
 * Hook to manage map view state, camera bounds, and primary map event handlers.
 * Handles bounds calculation for data fetching and syncs map position to URL params.
 *
 * @param isFollowing - Boolean indicating if the map is currently auto-following a vehicle.
 * @param performGeolocation - Function to trigger user geolocation.
 * @returns Map view state and event handlers (onMove, onMoveEnd, onLoad).
 */
export const useMapView = (
    isFollowing: boolean,
    performGeolocation: (isManual: boolean) => void
) => {
    const [mapLoaded, setMapLoaded] = useState(false);
    const [bounds, setBounds] = useState<string | null>(null);
    const [debouncedBounds, setDebouncedBounds] = useState<string | null>(null);
    const [labelLayerId, setLabelLayerId] = useState<string | undefined>(undefined);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const getRoundedBounds = useCallback((map: MapLibreMap) => {
        const b = map.getBounds();
        const zoom = map.getZoom();
        const round = (num: number) => Math.round(num * 1000) / 1000;
        return b && zoom >= MAP_MIN_ZOOM_FOR_VEHICLES
            ? `${round(b.getSouth())},${round(b.getWest())},${round(b.getNorth())},${round(b.getEast())}`
            : null;
    }, []);

    const onMove = useCallback((evt: ViewStateChangeEvent) => {
        if (isFollowing) return;

        const { zoom } = evt.viewState;
        if (!evt.originalEvent) return;

        const currentBounds = getRoundedBounds(evt.target);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedBounds(currentBounds);
            setBounds(currentBounds);
        }, BOUNDS_DEBOUNCE_MS);

        if (zoom < MAP_MIN_ZOOM_FOR_VEHICLES && bounds !== null) {
            setBounds(null);
        }
    }, [bounds, isFollowing, getRoundedBounds]);

    const onMoveEnd = useCallback((evt: ViewStateChangeEvent) => {
        if (isFollowing) return;

        const { latitude, longitude, zoom } = evt.viewState;
        const currentBounds = getRoundedBounds(evt.target);

        const url = new URL(window.location.href);
        url.searchParams.set('lat', latitude.toFixed(5));
        url.searchParams.set('lng', longitude.toFixed(5));
        url.searchParams.set('z', zoom.toFixed(2));
        window.history.replaceState({}, '', url.toString());

        if (evt.originalEvent) {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            setBounds(currentBounds);
            setDebouncedBounds(currentBounds);
        }
    }, [isFollowing, getRoundedBounds]);

    const onLoad = useCallback((evt: MapLibreEvent) => {
        const map = evt.target;
        const layers = map.getStyle().layers;
        if (layers) {
            const firstLabelLayer = layers.find((layer: LayerSpecification) =>
                layer.type === 'symbol' && (layer as SymbolLayerSpecification).layout?.['text-field']
            );
            if (firstLabelLayer) {
                setLabelLayerId(firstLabelLayer.id);
            }
        }
        addAllIcons(map);
        setMapLoaded(true);

        const b = map.getBounds();
        const z = map.getZoom();
        if (b && z >= MAP_MIN_ZOOM_FOR_VEHICLES) {
            const initialBounds = getRoundedBounds(map);
            setBounds(initialBounds);
            setDebouncedBounds(initialBounds);
        }

        performGeolocation(false);
    }, [performGeolocation, getRoundedBounds]);

    return {
        mapLoaded,
        bounds,
        debouncedBounds,
        labelLayerId,
        onMove,
        onMoveEnd,
        onLoad,
        setBounds,
        setDebouncedBounds
    };
};
