import React, { useEffect, useRef } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import type { VehicleCollection, VehicleFeature } from '../../types/vehicles';

const ANIMATION_DURATION = 1000; // 1 second smooth slide
const MAX_ANIMATE_DISTANCE_SQ = 0.0002; // ~1.5km threshold to snap immediately

interface TrackedPosition {
    coords: [number, number];
    bearing: number;
}

interface AnimationTarget {
    startCoords: [number, number];
    endCoords: [number, number];
    startBearing: number;
    endBearing: number;
    startTime: number;
}

const lerp = (start: number, end: number, t: number): number => {
    return start + (end - start) * t;
};

const interpolateBearing = (start: number, end: number, t: number): number => {
    let diff = (end - start) % 360;
    if (diff < -180) diff += 360;
    if (diff > 180) diff -= 360;
    return (start + diff * t + 360) % 360;
};

/**
 * Hook to smoothly animate vehicle movements on the map.
 * Intercepts new vehicle data and runs a requestAnimationFrame loop to slide
 * vehicles from their previous positions to their new positions.
 *
 * Performance: Bypasses React state completely during animation frames
 * by calling setData directly on MapLibre GeoJSON sources.
 */
const EMPTY_FC: VehicleCollection = { type: 'FeatureCollection', features: [] };

export const useVehicleAnimation = (
    mapRef: React.RefObject<MapRef | null>,
    mapLoaded: boolean,
    displayVehicles: VehicleCollection | null,
    selectedVehicleFeature: VehicleCollection | null,
    showVehicles: boolean
) => {
    const animationFrameRef = useRef<number | null>(null);
    const lastPositionsRef = useRef<Map<string, TrackedPosition>>(new Map());
    const targetsRef = useRef<Map<string, AnimationTarget>>(new Map());

    // Stable references for react-map-gl to initialize sources.
    // Since the object references never change, React Map GL never automatically calls setData,
    // allowing our requestAnimationFrame loop to have full exclusive control over updates.
    const displayGeoJSON = React.useMemo<VehicleCollection>(() => ({
        type: 'FeatureCollection',
        features: []
    }), []);
    const selectedGeoJSON = React.useMemo<VehicleCollection>(() => ({
        type: 'FeatureCollection',
        features: []
    }), []);

    // Store the latest raw features to reconstruct GeoJSON during the animation
    const displayVehiclesRawRef = useRef<VehicleFeature[]>([]);
    const selectedVehiclesRawRef = useRef<VehicleFeature[]>([]);

    useEffect(() => {
        if (!mapLoaded) return;

        const map = mapRef.current?.getMap();
        if (!map) return;

        const now = performance.now();
        const nextTargets = new Map<string, AnimationTarget>();
        const nextPositions = new Map<string, TrackedPosition>();

        // Process main stream vehicles
        const displayFeatures = displayVehicles?.features || [];
        displayVehiclesRawRef.current = displayFeatures;

        // Process selected vehicle
        const selectedFeatures = selectedVehicleFeature?.features || [];
        selectedVehiclesRawRef.current = selectedFeatures;

        const allFeatures = [...displayFeatures, ...selectedFeatures];

        allFeatures.forEach((f) => {
            const id = f.properties.vehicle_id || f.properties.gtfs_trip_id;
            if (!id) return;

            const endCoords = f.geometry.coordinates;
            const endBearing = f.properties.bearing ?? 0;

            const prevPos = lastPositionsRef.current.get(id);

            if (prevPos) {
                const dx = endCoords[0] - prevPos.coords[0];
                const dy = endCoords[1] - prevPos.coords[1];
                const distSq = dx * dx + dy * dy;

                if (distSq > MAX_ANIMATE_DISTANCE_SQ) {
                    // Snap immediately if it jumped a long distance
                    nextPositions.set(id, { coords: endCoords, bearing: endBearing });
                } else {
                    nextTargets.set(id, {
                        startCoords: prevPos.coords,
                        endCoords,
                        startBearing: prevPos.bearing,
                        endBearing,
                        startTime: now
                    });
                    // Start position is current position
                    nextPositions.set(id, prevPos);
                }
            } else {
                // New vehicle, starts at end coordinate
                nextPositions.set(id, { coords: endCoords, bearing: endBearing });
            }
        });

        // Update refs
        targetsRef.current = nextTargets;
        lastPositionsRef.current = nextPositions;

        // Animation frame loop function
        const animate = (time: number) => {
            let isAnyAnimating = false;
            const currentPositions = new Map<string, TrackedPosition>(lastPositionsRef.current);

            // 1. Calculate interpolated positions
            targetsRef.current.forEach((target, id) => {
                const elapsed = time - target.startTime;
                const t = Math.min(elapsed / ANIMATION_DURATION, 1);

                const coords: [number, number] = [
                    lerp(target.startCoords[0], target.endCoords[0], t),
                    lerp(target.startCoords[1], target.endCoords[1], t)
                ];
                const bearing = interpolateBearing(target.startBearing, target.endBearing, t);

                currentPositions.set(id, { coords, bearing });

                if (t < 1) {
                    isAnyAnimating = true;
                }
            });

            // Save positions so the next update can interpolate from where they currently are
            lastPositionsRef.current = currentPositions;

            // Reconstruct the GeoJSON features in our stable refs
            displayGeoJSON.features = displayVehiclesRawRef.current.map((f) => {
                const id = f.properties.vehicle_id || f.properties.gtfs_trip_id;
                const pos = id ? currentPositions.get(id) : null;
                if (pos) {
                    return {
                        ...f,
                        geometry: { ...f.geometry, coordinates: pos.coords },
                        properties: { ...f.properties, bearing: pos.bearing }
                    };
                }
                return f;
            });

            selectedGeoJSON.features = selectedVehiclesRawRef.current.map((f) => {
                const id = f.properties.vehicle_id || f.properties.gtfs_trip_id;
                const pos = id ? currentPositions.get(id) : null;
                if (pos) {
                    return {
                        ...f,
                        geometry: { ...f.geometry, coordinates: pos.coords },
                        properties: { ...f.properties, bearing: pos.bearing }
                    };
                }
                return f;
            });

            // 2. Direct map mutation: update GeoJSON sources bypassing React
            const cityVehiclesSource = map.getSource('city-vehicles') as maplibregl.GeoJSONSource | undefined;
            const selectedVehicleSource = map.getSource('selected-vehicle') as maplibregl.GeoJSONSource | undefined;

            if (cityVehiclesSource) {
                // Respect the showVehicles preference even in the direct-mutation path,
                // since this bypasses the React prop guard on the <Source> element.
                cityVehiclesSource.setData(showVehicles ? displayGeoJSON : EMPTY_FC);
            }

            if (selectedVehicleSource) {
                selectedVehicleSource.setData(selectedGeoJSON);
            }

            if (isAnyAnimating) {
                animationFrameRef.current = requestAnimationFrame(animate);
            }
        };

        // Start/Restart animation loop
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [mapLoaded, displayVehicles, selectedVehicleFeature, mapRef, displayGeoJSON, selectedGeoJSON, showVehicles]);

    return {
        displayGeoJSON,
        selectedGeoJSON
    };
};
