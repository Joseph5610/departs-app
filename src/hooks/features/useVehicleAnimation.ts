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

/** Animation state of one map source, keyed by vehicle. */
interface Track {
    positions: Map<string, TrackedPosition>;
    targets: Map<string, AnimationTarget>;
    /** Data time of the position last shown, to reject older snapshots. */
    times: Map<string, number>;
    lastSeen: Map<string, number>;
}

const emptyTrack = (): Track => ({ positions: new Map(), targets: new Map(), times: new Map(), lastSeen: new Map() });

/** Folds a new batch of features into a track, starting slides from where each vehicle is currently shown. */
const advanceTrack = (prev: Track, features: VehicleFeature[], collectionTime: number | undefined, now: number): Track => {
    const next = emptyTrack();

    for (const f of features) {
        const id = featureId(f);
        if (!id) continue;

        const endCoords = f.geometry.coordinates;
        const endBearing = f.properties.bearing ?? 0;
        const prevPos = prev.positions.get(id);
        const prevTime = prev.times.get(id);
        const dataTime = parseTime(f.properties.origin_timestamp) ?? collectionTime;
        next.lastSeen.set(id, now);

        // Each map bounds is cached separately upstream, so a response can carry an older snapshot than what is already shown.
        if (prevPos && prevTime !== undefined && dataTime !== undefined && dataTime < prevTime) {
            const target = prev.targets.get(id);
            if (target) next.targets.set(id, target);
            next.positions.set(id, prevPos);
            next.times.set(id, prevTime);
            continue;
        }

        const knownTime = dataTime ?? prevTime;
        if (knownTime !== undefined) next.times.set(id, knownTime);

        if (!prevPos) {
            next.positions.set(id, { coords: endCoords, bearing: endBearing });
            continue;
        }

        const dx = endCoords[0] - prevPos.coords[0];
        const dy = endCoords[1] - prevPos.coords[1];
        const distSq = dx * dx + dy * dy;

        if (distSq === 0 && prevPos.bearing === endBearing) {
            next.positions.set(id, prevPos);
        } else if (distSq > VEHICLE_ANIMATION.MAX_SLIDE_DISTANCE_SQ) {
            next.positions.set(id, { coords: endCoords, bearing: endBearing });
        } else {
            next.targets.set(id, { startCoords: prevPos.coords, endCoords, startBearing: prevPos.bearing, endBearing, startTime: now });
            next.positions.set(id, prevPos);
        }
    }

    // A vehicle that left the viewport comes back from an older cached bounds response, so its last shown state must outlive its absence.
    prev.lastSeen.forEach((seenAt, id) => {
        if (next.lastSeen.has(id) || now - seenAt > VEHICLE_ANIMATION.ABSENT_MEMORY_MS) return;
        const pos = prev.positions.get(id);
        if (!pos) return;
        next.positions.set(id, pos);
        next.lastSeen.set(id, seenAt);
        const time = prev.times.get(id);
        if (time !== undefined) next.times.set(id, time);
    });

    return next;
};

/** Advances a track's slides to `time`; returns whether any vehicle moved. */
const stepTrack = (track: Track, time: number): boolean => {
    let moved = false;
    track.targets.forEach((target, id) => {
        const t = Math.min((time - target.startTime) / VEHICLE_ANIMATION.DURATION_MS, 1);
        track.positions.set(id, {
            coords: [
                lerp(target.startCoords[0], target.endCoords[0], t),
                lerp(target.startCoords[1], target.endCoords[1], t)
            ],
            bearing: interpolateBearing(target.startBearing, target.endBearing, t)
        });
        moved = true;
        if (t >= 1) track.targets.delete(id);
    });
    return moved;
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
    // One track per source: the stream and the detail arrive at different moments, and sharing positions let one drag the other back and forth.
    const displayTrackRef = useRef<Track>(emptyTrack());
    const selectedTrackRef = useRef<Track>(emptyTrack());

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

        // Process main stream vehicles
        const displayFeatures = displayVehicles?.features || [];
        displayVehiclesRawRef.current = displayFeatures;

        // Process selected vehicle
        const selectedFeatures = selectedVehicleFeature?.features || [];
        selectedVehiclesRawRef.current = selectedFeatures;

        displayTrackRef.current = advanceTrack(displayTrackRef.current, displayFeatures, parseTime(displayVehicles?.last_updated), now);
        selectedTrackRef.current = advanceTrack(selectedTrackRef.current, selectedFeatures, parseTime(selectedVehicleFeature?.last_updated), now);

        let isFirstFrame = true;

        const animate = (time: number) => {
            const displayTrack = displayTrackRef.current;
            const selectedTrack = selectedTrackRef.current;
            const displayMoved = stepTrack(displayTrack, time);
            const selectedMoved = stepTrack(selectedTrack, time);

            // Direct map mutation bypassing React; a source is only re-sent when one of its vehicles moved.
            const cityVehiclesSource = map.getSource(MAP_SOURCES.VEHICLES) as GeoJSONSource | undefined;
            const selectedVehicleSource = map.getSource(MAP_SOURCES.SELECTED_VEHICLE) as GeoJSONSource | undefined;

            if (cityVehiclesSource && (isFirstFrame || displayMoved)) {
                displayGeoJSON.features = withDisplayedPositions(displayVehiclesRawRef.current, displayTrack.positions);
                // Respect showVehicles here too: this path bypasses the React prop guard on <Source>.
                cityVehiclesSource.setData(showVehicles ? displayGeoJSON : EMPTY_FEATURE_COLLECTION);
            }

            if (selectedVehicleSource && (isFirstFrame || selectedMoved)) {
                selectedGeoJSON.features = withDisplayedPositions(selectedVehiclesRawRef.current, selectedTrack.positions);
                selectedVehicleSource.setData(selectedGeoJSON);
            }

            isFirstFrame = false;
            if (displayTrack.targets.size > 0 || selectedTrack.targets.size > 0) {
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
