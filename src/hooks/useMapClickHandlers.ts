
import { useCallback } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent, GeoJSONSource } from 'maplibre-gl';
import type { Point } from 'geojson';
import type { TrackedVehicle } from '../types/transit';

/**
 * Handles map click events for clusters, vehicles, and stops.
 */
export const useMapClickHandlers = (
    mapRef: React.RefObject<MapRef | null>,
    setSelectedVehicle: (v: TrackedVehicle | null) => void,
    setSelectedStop: (s: { id: string; name: string } | null) => void,
    setIsFollowing: (f: boolean) => void,
    setExpandedGroups: (g: string[]) => void
) => {
    return useCallback((evt: MapLayerMouseEvent) => {
        const f = evt.features?.[0];
        if (!f || f.layer.id === 'entrance-layer') return;

        // 1. Handle Clusters
        if (f.layer.id === 'clusters') {
            const clusterId = f.properties?.cluster_id;
            const source = mapRef.current?.getMap().getSource('pid-stops') as GeoJSONSource;
            source.getClusterExpansionZoom(clusterId, (err, zoom) => {
                if (err) return;
                mapRef.current?.easeTo({
                    center: (f.geometry as Point).coordinates as [number, number],
                    zoom: zoom ?? 15,
                    duration: 500
                });
            });
            return;
        }

        // 2. Handle Vehicles
        if (f.layer.id === 'vehicles-point' || f.layer.id === 'vehicles-direction-fg' || f.layer.id === 'vehicles-label') {
            const props = f.properties;
            setSelectedVehicle({
                ...props,
                vehicle_id: String(props.vehicle_id || props.id),
                _geometry: (f.geometry as Point).coordinates as [number, number]
            } as TrackedVehicle);
            setSelectedStop(null);
            setIsFollowing(true);
            return;
        }

        // 3. Handle Stops
        if (f.layer.id === 'unclustered-point' || f.layer.id === 'transfer-stations') {
            const pc = f.properties.platform_code;
            const name = (pc && pc.trim().length > 0) ? `${f.properties.stop_name} (${pc})` : f.properties.stop_name;
            setSelectedStop({ id: f.properties.stop_id, name });
            setSelectedVehicle(null);
            setExpandedGroups([]);
        }
    }, [mapRef, setSelectedVehicle, setSelectedStop, setIsFollowing, setExpandedGroups]);
};
