import React, { useEffect, useRef } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import type { GeoJSONSource } from 'maplibre-gl';
import type { VehicleCollection, VehicleFeature } from '../../types/vehicles';
import { VEHICLE_ANIMATION } from '../../config/constants';
import { MAP_SOURCES } from '../../config/mapLayers';
import { EMPTY_FEATURE_COLLECTION } from '../../lib/geojson';

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

const featureId = (f: VehicleFeature): string | null => f.properties.vehicle_id || f.properties.gtfs_trip_id || null;

/** The features with their on-screen positions; features already where their data says are reused as-is. */
const withDisplayedPositions = (features: VehicleFeature[], positions: Map<string, TrackedPosition>): VehicleFeature[] =>
    features.map((f) => {
        const id = featureId(f);
        const pos = id ? positions.get(id) : undefined;
        if (!pos) return f;
        const [lng, lat] = f.geometry.coordinates;
        if (pos.coords[0] === lng && pos.coords[1] === lat && pos.bearing === (f.properties.bearing ?? 0)) return f;
        return {
            ...f,
            geometry: { ...f.geometry, coordinates: pos.coords },
            properties: { ...f.properties, bearing: pos.bearing }
        };
    });

const parseTime = (iso: string | undefined): number | undefined => {
    if (!iso) return undefined;
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? undefined : ms;
};

/**
 * Hook to smoothly animate vehicle movements on the map.
 * Intercepts new vehicle data and runs a requestAnimationFrame loop to slide
 * vehicles from their previous positions to their new positions.
 *
 * Performance: Bypasses React state completely during animation frames
 * by calling setData directly on MapLibre GeoJSON sources.
 */
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
    // Per source: stream and detail timestamps come from different clocks and must not be compared.
    const displayTimesRef = useRef<Map<string, number>>(new Map());
    const selectedTimesRef = useRef<Map<string, number>>(new Map());

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
        const nextDisplayTimes = new Map<string, number>();
        const nextSelectedTimes = new Map<string, number>();

        // Process main stream vehicles
        const displayFeatures = displayVehicles?.features || [];
        displayVehiclesRawRef.current = displayFeatures;

        // Process selected vehicle
        const selectedFeatures = selectedVehicleFeature?.features || [];
        selectedVehiclesRawRef.current = selectedFeatures;

        const processFeature = (
            f: VehicleFeature,
            collectionTime: number | undefined,
            prevTimes: Map<string, number>,
            nextTimes: Map<string, number>
        ) => {
            const id = featureId(f);
            if (!id) return;

            const endCoords = f.geometry.coordinates;
            const endBearing = f.properties.bearing ?? 0;

            const prevPos = lastPositionsRef.current.get(id);
            const prevTime = prevTimes.get(id);
            const dataTime = parseTime(f.properties.origin_timestamp) ?? collectionTime;

            // Each map bounds is cached separately upstream, so a response can carry an older snapshot than what is already shown.
            if (prevPos && prevTime !== undefined && dataTime !== undefined && dataTime < prevTime) {
                const target = targetsRef.current.get(id);
                if (target) nextTargets.set(id, target);
                nextPositions.set(id, prevPos);
                nextTimes.set(id, prevTime);
                return;
            }

            const knownTime = dataTime ?? prevTime;
            if (knownTime !== undefined) nextTimes.set(id, knownTime);

            if (prevPos) {
                const dx = endCoords[0] - prevPos.coords[0];
                const dy = endCoords[1] - prevPos.coords[1];
                const distSq = dx * dx + dy * dy;

                if (distSq === 0 && prevPos.bearing === endBearing) {
                    nextPositions.set(id, prevPos);
                } else if (distSq > VEHICLE_ANIMATION.MAX_SLIDE_DISTANCE_SQ) {
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
        };

        const displayTime = parseTime(displayVehicles?.last_updated);
        const selectedTime = parseTime(selectedVehicleFeature?.last_updated);
        displayFeatures.forEach((f) => processFeature(f, displayTime, displayTimesRef.current, nextDisplayTimes));
        selectedFeatures.forEach((f) => processFeature(f, selectedTime, selectedTimesRef.current, nextSelectedTimes));

        // Update refs
        targetsRef.current = nextTargets;
        lastPositionsRef.current = nextPositions;
        displayTimesRef.current = nextDisplayTimes;
        selectedTimesRef.current = nextSelectedTimes;

        let lastUpdateTime = -Infinity;
        let isFirstFrame = true;

        const animate = (time: number) => {
            const targets = targetsRef.current;
            if (!isFirstFrame && time - lastUpdateTime < VEHICLE_ANIMATION.MIN_FRAME_INTERVAL_MS) {
                animationFrameRef.current = requestAnimationFrame(animate);
                return;
            }
            lastUpdateTime = time;

            const positions = lastPositionsRef.current;
            const moved = new Set<string>();
            targets.forEach((target, id) => {
                const t = Math.min((time - target.startTime) / VEHICLE_ANIMATION.DURATION_MS, 1);
                positions.set(id, {
                    coords: [
                        lerp(target.startCoords[0], target.endCoords[0], t),
                        lerp(target.startCoords[1], target.endCoords[1], t)
                    ],
                    bearing: interpolateBearing(target.startBearing, target.endBearing, t)
                });
                moved.add(id);
                if (t >= 1) targets.delete(id);
            });

            const hasMoved = (features: VehicleFeature[]) => features.some((f) => {
                const id = featureId(f);
                return id !== null && moved.has(id);
            });

            // Direct map mutation bypassing React; a source is only re-sent when one of its vehicles moved.
            const cityVehiclesSource = map.getSource(MAP_SOURCES.VEHICLES) as GeoJSONSource | undefined;
            const selectedVehicleSource = map.getSource(MAP_SOURCES.SELECTED_VEHICLE) as GeoJSONSource | undefined;

            if (cityVehiclesSource && (isFirstFrame || hasMoved(displayVehiclesRawRef.current))) {
                displayGeoJSON.features = withDisplayedPositions(displayVehiclesRawRef.current, positions);
                // Respect showVehicles here too: this path bypasses the React prop guard on <Source>.
                cityVehiclesSource.setData(showVehicles ? displayGeoJSON : EMPTY_FEATURE_COLLECTION);
            }

            if (selectedVehicleSource && (isFirstFrame || hasMoved(selectedVehiclesRawRef.current))) {
                selectedGeoJSON.features = withDisplayedPositions(selectedVehiclesRawRef.current, positions);
                selectedVehicleSource.setData(selectedGeoJSON);
            }

            isFirstFrame = false;
            if (targets.size > 0) {
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
