
import { useCallback } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent, MapGeoJSONFeature } from 'maplibre-gl';
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
        const features = evt.features as MapGeoJSONFeature[] | undefined;
        const f = features?.[0];
        if (!f || f.layer.id === 'entrance-layer') return;

        // 1. Handle Clusters
        if (f.layer.id === 'clusters') {
            const clusterId = f.properties?.cluster_id;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const source = mapRef.current?.getMap().getSource('pid-stops') as any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            source?.getClusterExpansionZoom(clusterId, (err: any, zoom: any) => {
                if (err || !zoom) return;
                mapRef.current?.easeTo({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    center: (f.geometry as any).coordinates as [number, number],
                    zoom,
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
                vehicle_id: String(props?.vehicle_id || props?.id),
                _geometry: (f.geometry as Point).coordinates as [number, number]
            } as TrackedVehicle);
            setSelectedStop(null);
            setIsFollowing(true);
            return;
        }

        // 3. Handle Stops
        if (f.layer.id === 'unclustered-point' || f.layer.id === 'transfer-stations') {
            const props = f.properties;
            const pc = props?.platform_code;
            const name = (pc && pc.trim().length > 0) ? `${props?.stop_name} (${pc})` : props?.stop_name;
            setSelectedStop({ id: props?.stop_id, name });
            setSelectedVehicle(null);
            setExpandedGroups([]);
        }
    }, [mapRef, setSelectedVehicle, setSelectedStop, setIsFollowing, setExpandedGroups]);
};
