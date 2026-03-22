import type { VehicleDetail, VehicleCollection } from '../types/transit';

/**
 * Synchronizes selected vehicle properties between the high-frequency map stream
 * and the low-frequency detail API.
 */
export const syncVehicleProperties = (
    current: VehicleDetail,
    stream: VehicleCollection | null | undefined,
    detail: VehicleDetail | null | undefined,
    selectedId: string | null
): { updated: boolean; merged: VehicleDetail } => {
    let updated = false;
    let newProps: Partial<VehicleDetail> = {};
    const currentCoords = current.geometry?.coordinates || [0, 0];
    let newCoords = [...currentCoords] as [number, number];

    // 1. Merge from Stream
    if (stream?.features) {
        const match = stream.features.find((f) => {
            if (selectedId) {
                return f.properties.vehicle_id === selectedId;
            }
            return f.properties.gtfs_trip_id === current.gtfs_trip_id;
        });

        if (match?.geometry) {
            const p = match.properties;
            const coords = match.geometry.coordinates as [number, number];
            const tripIdChanged = p.gtfs_trip_id !== current.gtfs_trip_id;
            const hasValidLocation = coords[0] !== 0 || coords[1] !== 0;

            if (currentCoords[0] !== coords[0] || current.delay !== p.delay || tripIdChanged) {
                updated = true;
                newProps = { ...p, vehicle_id: selectedId || p.vehicle_id };
                if (tripIdChanged && p.last_stop_sequence === undefined) {
                    newProps.last_stop_sequence = null;
                }
                if (hasValidLocation || (currentCoords[0] === 0 && currentCoords[1] === 0)) {
                    newCoords = coords;
                }
            }
        }
    }

    // 2. Merge from Detail API
    if (detail) {
        const isFallback = detail.is_static_fallback;
        const detailCoords = detail.geometry?.coordinates as [number, number] | undefined;
        const hasValidDetailLocation = detailCoords && (detailCoords[0] !== 0 || detailCoords[1] !== 0);

        const coordsChanged = detailCoords && (newCoords[0] !== detailCoords[0] || newCoords[1] !== detailCoords[1]);
        const bearingChanged = !isFallback && detail.bearing !== undefined && current.bearing !== detail.bearing;
        const tripIdChanged = detail.gtfs_trip_id !== current.gtfs_trip_id;

        const currentDelay = newProps.delay ?? current.delay ?? 0;
        const detailDelayValue = detail.delay ?? 0;
        const shouldUpdateDelay = !isFallback && (detailDelayValue !== 0 || currentDelay === 0);
        const delayChanged = shouldUpdateDelay && currentDelay !== detailDelayValue;

        const sequenceChanged = !isFallback && detail.last_stop_sequence !== undefined && current.last_stop_sequence !== detail.last_stop_sequence;

        const routeInfoChanged =
            (detail.route_short_name !== undefined && current.route_short_name !== detail.route_short_name) ||
            (detail.route_type !== undefined && current.route_type !== detail.route_type) ||
            (detail.trip_headsign !== undefined && current.trip_headsign !== detail.trip_headsign);

        if (coordsChanged || delayChanged || bearingChanged || sequenceChanged || tripIdChanged || routeInfoChanged) {
            updated = true;
            if (hasValidDetailLocation || (newCoords[0] === 0 && newCoords[1] === 0)) {
                if (detailCoords) {
                    newCoords = detailCoords;
                }
            }

            newProps = {
                ...newProps,
                gtfs_trip_id: detail.gtfs_trip_id || newProps.gtfs_trip_id,
                delay: shouldUpdateDelay ? detailDelayValue : currentDelay,
                bearing: isFallback ? (tripIdChanged ? null : (newProps.bearing ?? current.bearing)) : (detail.bearing ?? newProps.bearing),
                state_position: isFallback ? (tripIdChanged ? 'on_track' : (newProps.state_position ?? current.state_position)) : (detail.state_position || newProps.state_position),
                last_stop_sequence: isFallback ? (tripIdChanged ? null : (newProps.last_stop_sequence ?? current.last_stop_sequence)) : (detail.last_stop_sequence ?? (tripIdChanged ? null : newProps.last_stop_sequence)),
                origin_timestamp: isFallback ? (tripIdChanged ? undefined : (newProps.origin_timestamp ?? current.origin_timestamp)) : (detail.origin_timestamp || newProps.origin_timestamp),
                route_short_name: detail.route_short_name || newProps.route_short_name || current.route_short_name,
                route_type: detail.route_type ?? newProps.route_type ?? current.route_type,
                trip_headsign: detail.trip_headsign || newProps.trip_headsign || current.trip_headsign,
                vehicle_descriptor: {
                    ...(newProps.vehicle_descriptor || current.vehicle_descriptor),
                    vehicle_registration_number: detail.vehicle_descriptor?.vehicle_registration_number || newProps.vehicle_descriptor?.vehicle_registration_number || current.vehicle_descriptor?.vehicle_registration_number
                }
            };
        }
    }

    if (updated) {
        // Deep equality check for state stability
        const hasGeometryChanged = currentCoords[0] !== newCoords[0] || currentCoords[1] !== newCoords[1];
        const hasDelayChanged = newProps.delay !== undefined && current.delay !== newProps.delay;
        const hasBearingChanged = newProps.bearing !== undefined && current.bearing !== newProps.bearing;
        const hasSequenceChanged = newProps.last_stop_sequence !== undefined && current.last_stop_sequence !== newProps.last_stop_sequence;
        const hasStateChanged = newProps.state_position !== undefined && current.state_position !== newProps.state_position;
        const hasOriginChanged = newProps.origin_timestamp !== undefined && current.origin_timestamp !== newProps.origin_timestamp;
        const hasTripChanged = newProps.gtfs_trip_id !== undefined && current.gtfs_trip_id !== newProps.gtfs_trip_id;
        const hasRouteInfoChanged =
            (newProps.route_short_name !== undefined && current.route_short_name !== newProps.route_short_name) ||
            (newProps.route_type !== undefined && current.route_type !== newProps.route_type);

        if (!hasGeometryChanged && !hasDelayChanged && !hasBearingChanged && !hasSequenceChanged && !hasStateChanged && !hasTripChanged && !hasOriginChanged && !hasRouteInfoChanged) {
            return { updated: false, merged: current };
        }

        return {
            updated: true,
            merged: { ...current, ...newProps, geometry: { type: 'Point', coordinates: newCoords } } as VehicleDetail
        };
    }

    return { updated: false, merged: current };
};
