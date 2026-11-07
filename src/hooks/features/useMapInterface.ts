import { useEffect, useRef } from 'react';
import { useRouteParams } from '@/hooks/useRouteParams';
import { useSelectionStore } from '@/state/selectionStore';
import { useMapMetadataStore } from '@/state/mapMetadataStore';
import { useIsPanelRoute } from '@/hooks/useIsPanelRoute';
import { useSidebarWidthPx } from '@/hooks/derived/useSidebarWidthPx';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MAP_LAYERS } from '@/config/mapLayers';
import { hasPosition } from '@/lib/geo';
import { useSelectedStop } from '@/hooks/derived/useSelectedStop';
import { useSelectedVehicle } from '@/hooks/derived/useSelectedVehicle';
import { MAP_CAMERA, SELECTED_VEHICLE_PULSE, SHEET } from '@/config/constants';

/** The panel's inset from the viewport lives in index.css; the camera padding must match it. */
const readSidebarInsetPx = (): number =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-inset')) || 0;

/** The map area the mobile sheet or the desktop panel `sidebarWidth` wide covers, kept clear by the camera. */
const cameraPadding = (isMobile: boolean, sidebarWidth: number) => isMobile
    ? { bottom: window.innerHeight * SHEET.HALF, top: 0, left: 0, right: 0 }
    : { bottom: 0, top: 0, left: sidebarWidth + readSidebarInsetPx(), right: 0 };

/**
 * The "User Experience Layer" hook.
 */
export const useMapInterface = () => {
    const { stopId: selectedStopId, tripId: selectedTripId, vehicleId: selectedVehicleId } = useRouteParams();

    const isFollowing = useSelectionStore(s => s.isFollowing);

    const mapRef = useMapMetadataStore(s => s.mapRef);
    const mapLoaded = useMapMetadataStore(s => s.mapLoaded);
    const { flyTo, easeTo } = useMapMetadataStore(s => s.actions);

    const selectedStopPos = useSelectedStop()?.board?.pos;
    const selectedVehicle = useSelectedVehicle();
    const isMobile = useIsMobile();

    const sidebarWidth = useSidebarWidthPx();
    const sidebarWidthRef = useRef(sidebarWidth);
    useEffect(() => {
        sidebarWidthRef.current = sidebarWidth;
    }, [sidebarWidth]);

    const lastFlownId = useRef<string | null>(null);
    const lastFlownStopId = useRef<string | null>(null);

    // Camera: fly to a newly followed vehicle, keep easing after it, or ease to a newly opened stop.
    useEffect(() => {
        if (!mapLoaded || !mapRef.current) {
            return;
        }

        const padding = cameraPadding(isMobile, sidebarWidthRef.current);

        const currentMap = mapRef.current;
        const currentId = selectedVehicleId || selectedTripId;
        const coords = selectedVehicle?.geometry?.coordinates;
        const hasCoords = hasPosition(coords);

        // Returning to the stop after a trip must re-centre on it.
        if (selectedTripId) {
            lastFlownStopId.current = null;
        }

        if (isFollowing && hasCoords && lastFlownId.current !== currentId) {
            lastFlownId.current = currentId || null;
            flyTo({
                center: coords,
                zoom: MAP_CAMERA.VEHICLE_SELECT_ZOOM,
                duration: MAP_CAMERA.ANIMATION_MS,
                essential: true,
                padding
            });
            return;
        }

        if (isFollowing && hasCoords) {
            easeTo({
                center: coords,
                duration: MAP_CAMERA.EASE_MS,
                essential: true,
                padding
            });
            return;
        }

        if (!isFollowing && !selectedTripId && selectedStopPos && lastFlownStopId.current !== selectedStopId) {
            lastFlownStopId.current = selectedStopId || null;
            easeTo({
                center: selectedStopPos,
                zoom: Math.max(currentMap.getZoom(), MAP_CAMERA.MIN_STOP_ZOOM),
                duration: MAP_CAMERA.EASE_MS,
                padding
            });
        }
    }, [selectedVehicle?.geometry?.coordinates, isFollowing, mapRef, flyTo, easeTo, selectedStopPos, selectedTripId, selectedVehicleId, selectedStopId, isMobile, mapLoaded]);

    // A resized panel or window keeps the map's centre in the middle of the part the open panel leaves visible.
    const isPanelRoute = useIsPanelRoute();
    const paddedFor = useRef<string | null>(null);
    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!mapLoaded || !map || !isPanelRoute) return;
        // Phones resize with their keyboard, which must not move the map; growing into desktop pads for the panel.
        if (isMobile) {
            paddedFor.current = 'mobile';
            return;
        }
        const key = String(sidebarWidth);
        if (paddedFor.current === null || paddedFor.current === key) {
            paddedFor.current = key;
            return;
        }
        paddedFor.current = key;
        const repad = () => easeTo({ padding: cameraPadding(false, sidebarWidthRef.current), duration: MAP_CAMERA.EASE_MS, essential: true });
        // A fly or ease already under way finishes first instead of being cut short.
        if (!map.isMoving()) {
            repad();
            return;
        }
        map.once('moveend', repad);
        return () => {
            map.off('moveend', repad);
        };
    }, [sidebarWidth, isPanelRoute, isMobile, mapLoaded, mapRef, easeTo]);

    // Selected vehicle pulse, animated on the map layer directly to stay off React renders.
    const selectedCoordsRef = useRef(selectedVehicle?.geometry?.coordinates);
    const restartPulseRef = useRef<(() => void) | null>(null);
    const [lng, lat] = selectedVehicle?.geometry?.coordinates ?? [];
    useEffect(() => {
        selectedCoordsRef.current = selectedVehicle?.geometry?.coordinates;
    }, [selectedVehicle?.geometry?.coordinates]);
    // Keyed on the values, not the array, which is new on every render.
    useEffect(() => {
        restartPulseRef.current?.();
    }, [lng, lat]);
    const hasSelectedVehicle = !!selectedVehicle;

    useEffect(() => {
        let frame = 0;
        let pulseUntil = 0;
        const currentMapRef = mapRef.current;
        const reducesMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const paint = (radius: number, opacity: number) => {
            const map = mapRef.current?.getMap();
            if (!map || !hasPosition(selectedCoordsRef.current)) return;
            try {
                if (map.getLayer(MAP_LAYERS.SELECTED_VEHICLE_PULSE)) {
                    map.setPaintProperty(MAP_LAYERS.SELECTED_VEHICLE_PULSE, 'circle-radius', radius);
                    map.setPaintProperty(MAP_LAYERS.SELECTED_VEHICLE_PULSE, 'circle-opacity', Math.max(0.1, opacity));
                }
            } catch {
                /* Silent fail */
            }
        };
        const opacityAt = (radius: number) => SELECTED_VEHICLE_PULSE.BASE_OPACITY - ((radius - 5) / SELECTED_VEHICLE_PULSE.OPACITY_DIVISOR);

        const animate = () => {
            frame = 0;
            const now = Date.now();
            if (reducesMotion || now >= pulseUntil) {
                paint(SELECTED_VEHICLE_PULSE.BASE_RADIUS, opacityAt(SELECTED_VEHICLE_PULSE.BASE_RADIUS));
                return;
            }
            const radius = SELECTED_VEHICLE_PULSE.BASE_RADIUS + Math.sin(now / SELECTED_VEHICLE_PULSE.SPEED_DIVISOR) * SELECTED_VEHICLE_PULSE.RADIUS_AMPLITUDE;
            paint(radius, opacityAt(radius));
            frame = requestAnimationFrame(animate);
        };

        const start = () => {
            pulseUntil = Date.now() + SELECTED_VEHICLE_PULSE.PULSE_MS;
            if (!frame) frame = requestAnimationFrame(animate);
        };

        if (hasSelectedVehicle) {
            restartPulseRef.current = start;
            start();
        }

        return () => {
            restartPulseRef.current = null;
            if (frame) {
                cancelAnimationFrame(frame);
            }
            const map = currentMapRef?.getMap();
            if (map && map.getLayer(MAP_LAYERS.SELECTED_VEHICLE_PULSE)) {
                try {
                    map.setPaintProperty(MAP_LAYERS.SELECTED_VEHICLE_PULSE, 'circle-radius', 0);
                    map.setPaintProperty(MAP_LAYERS.SELECTED_VEHICLE_PULSE, 'circle-opacity', 0);
                } catch {
                    /* Silent fail */
                }
            }
        };
    }, [hasSelectedVehicle, mapRef]);
};
