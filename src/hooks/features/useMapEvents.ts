import type { Map, SymbolLayerSpecification } from 'maplibre-gl';
import { useCallback, useRef } from 'react';
import { useSelectionStore } from '../../state/selectionStore';
import { useViewportStore } from '../../state/viewportStore';
import { useMapMetadataStore } from '../../state/mapMetadataStore';
import { addAllIcons } from '../../utils/mapIcons';
import {
    MAP_MIN_ZOOM_FOR_DATA,
    MAP_BOUNDS_DEBOUNCE,
} from '../../config/constants';

/**
 * Hook to manage MapLibre events and sync them with global stores.
 * Used by the Map component to decouple event logic from the UI.
 */
export const useMapEvents = () => {
    const { setMapLoaded, setLabelLayerId } = useMapMetadataStore(s => s.actions);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isFollowing = useSelectionStore(s => s.isFollowing);
    const selActions = useSelectionStore(s => s.actions);
    const bounds = useViewportStore(s => s.bounds);
    const vpActions = useViewportStore(s => s.actions);

    const getRoundedBounds = useCallback((map: Map) => {
        const b = map.getBounds();
        const zoom = map.getZoom();
        const round = (num: number) => Math.round(num * 1000) / 1000;
        return b && zoom >= MAP_MIN_ZOOM_FOR_DATA
            ? `${round(b.getSouth())},${round(b.getWest())},${round(b.getNorth())},${round(b.getEast())}`
            : null;
    }, []);

    const onMove = useCallback((evt: { viewState: { zoom: number }; target: Map; originalEvent?: unknown }) => {
        if (evt.originalEvent && isFollowing) {
            selActions.setIsFollowing(false);
        }

        if (isFollowing) return;
        if (!evt.originalEvent) return;

        const { zoom } = evt.viewState;
        const currentBounds = getRoundedBounds(evt.target);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            vpActions.setDebouncedBounds(currentBounds);
            vpActions.setBounds(currentBounds);
        }, MAP_BOUNDS_DEBOUNCE);

        if (zoom < MAP_MIN_ZOOM_FOR_DATA && bounds !== null) {
            vpActions.setBounds(null);
        }
    }, [bounds, isFollowing, getRoundedBounds, vpActions, selActions]);

    const onMoveEnd = useCallback((evt: { viewState: { latitude: number; longitude: number; zoom: number }; target: Map; originalEvent?: unknown }) => {
        if (isFollowing) return;

        const { latitude, longitude, zoom } = evt.viewState;
        const currentBounds = getRoundedBounds(evt.target);

        const url = new URL(window.location.href);
        url.searchParams.set('lat', latitude.toFixed(5));
        url.searchParams.set('lng', longitude.toFixed(5));
        url.searchParams.set('z', zoom.toFixed(2));
        window.history.replaceState({}, '', url.toString());

        if (debounceRef.current) clearTimeout(debounceRef.current);
        vpActions.setBounds(currentBounds);
        vpActions.setDebouncedBounds(currentBounds);
    }, [isFollowing, getRoundedBounds, vpActions]);

    const onDragStart = useCallback(() => {
        if (isFollowing) selActions.setIsFollowing(false);
    }, [isFollowing, selActions]);

    const onLoad = useCallback((evt: { target: Map }) => {
        const map = evt.target;
        const style = map.getStyle();
        const layers = style?.layers;
        if (layers) {
            const firstLabelLayer = layers.find(layer => layer.type === 'symbol' && (layer as SymbolLayerSpecification).layout?.['text-field']);
            if (firstLabelLayer) setLabelLayerId(firstLabelLayer.id);
        }
        addAllIcons(map);
        setMapLoaded(true);

        const initialBounds = getRoundedBounds(map);
        if (initialBounds) {
            vpActions.setBounds(initialBounds);
            vpActions.setDebouncedBounds(initialBounds);
        }
    }, [vpActions, getRoundedBounds, setLabelLayerId, setMapLoaded]);

    return { onMove, onMoveEnd, onLoad, onDragStart };
};
