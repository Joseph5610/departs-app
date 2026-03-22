import { MAP_DEFAULT_COORDS, STORAGE_KEYS } from '../config/constants';

/**
 * Calculates the initial map view state based on URL parameters or stored user location.
 * Falls back to default Prague coordinates if no other data is available.
 *
 * @returns Object containing initial latitude, longitude, and zoom
 */
export const getInitialViewState = () => {
    const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');

    // Default values
    let lat = MAP_DEFAULT_COORDS.lat;
    let lng = MAP_DEFAULT_COORDS.lng;
    let z = MAP_DEFAULT_COORDS.zoom;

    // Try to get from localStorage if no URL params are present
    if (typeof window !== 'undefined' && !p.has('lat') && !p.has('lng')) {
        const saved = localStorage.getItem(STORAGE_KEYS.LAST_LOCATION);
        if (saved) {
            try {
                const { lat: sLat, lng: sLng } = JSON.parse(saved);
                if (typeof sLat === 'number' && typeof sLng === 'number') {
                    lat = sLat;
                    lng = sLng;
                    z = MAP_DEFAULT_COORDS.userZoom;
                }
            } catch (e) {
                console.error('Failed to parse lastUserLocation', e);
            }
        }
    }

    return {
        latitude: parseFloat(p.get('lat') || lat.toString()),
        longitude: parseFloat(p.get('lng') || lng.toString()),
        zoom: parseFloat(p.get('z') || z.toString())
    };
};

import type { VehicleDetail, SelectedStop } from '../types/transit';

import type { VehicleDescriptor } from '../types/transit';

/**
 * Safely extracts vehicle properties from a MapLibre feature.
 * Handles stringified JSON and ensures correct numeric types.
 */
export const extractVehicleProperties = (feature: { properties: Record<string, any> | null; geometry?: any }): VehicleDetail => {
    const rawProps = feature.properties || {};

    let vehicle_descriptor: VehicleDescriptor | undefined = undefined;
    if (typeof rawProps.vehicle_descriptor === 'string') {
        try {
            vehicle_descriptor = JSON.parse(rawProps.vehicle_descriptor);
        } catch {
            // Fallback if parsing fails
        }
    } else if (typeof rawProps.vehicle_descriptor === 'object') {
        vehicle_descriptor = rawProps.vehicle_descriptor;
    }

    const vehicle_id = String(rawProps.vehicle_id || rawProps.id || '');
    const gtfs_trip_id = String(rawProps.gtfs_trip_id || '');

    return {
        vehicle_id,
        gtfs_trip_id,
        route_short_name: rawProps.route_short_name !== undefined ? String(rawProps.route_short_name) : undefined,
        route_type: rawProps.route_type !== undefined ? (isNaN(Number(rawProps.route_type)) ? String(rawProps.route_type) : Number(rawProps.route_type)) : undefined,
        trip_headsign: rawProps.trip_headsign !== undefined ? String(rawProps.trip_headsign) : undefined,
        bearing: rawProps.bearing !== undefined && rawProps.bearing !== null && rawProps.bearing !== '' ? Number(rawProps.bearing) : null,
        delay: Number(rawProps.delay || 0),
        state_position: rawProps.state_position !== undefined ? String(rawProps.state_position) : undefined,
        next_stop_name: rawProps.next_stop_name !== undefined ? String(rawProps.next_stop_name) : undefined,
        run_number: rawProps.run_number !== undefined ? (isNaN(Number(rawProps.run_number)) ? String(rawProps.run_number) : Number(rawProps.run_number)) : undefined,
        last_stop_sequence: rawProps.last_stop_sequence !== undefined && rawProps.last_stop_sequence !== null && rawProps.last_stop_sequence !== '' ? Number(rawProps.last_stop_sequence) : null,
        origin_timestamp: rawProps.origin_timestamp !== undefined ? String(rawProps.origin_timestamp) : undefined,
        vehicle_descriptor,
        geometry: feature.geometry
    };
};

/**
 * Safely extracts stop properties from a MapLibre feature.
 */
export const extractStopProperties = (feature: { properties: Record<string, any> | null; geometry?: any }): SelectedStop => {
    const p = feature.properties || {};
    const geom = feature.geometry;
    const coordinates = geom && 'coordinates' in geom ? geom.coordinates : geom;

    return {
        stop_id: String(p.stop_id),
        stop_name: String(p.stop_name),
        platform_code: p.platform_code ? String(p.platform_code) : undefined,
        is_train: Number(p.is_train) === 1,
        coordinates: coordinates as [number, number]
    };
};
