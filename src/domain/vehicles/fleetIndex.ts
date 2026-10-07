import type { VehicleCollection, VehicleFeature } from '@/types';

/** The fleet by vehicle id and by trip id, for O(1) joins with details, departures and connections. */
export const indexVehicles = (collection: VehicleCollection | null) => {
    const vehicleIndex = new Map<string, VehicleFeature>();
    const tripIndex = new Map<string, VehicleFeature>();
    for (const f of collection?.features ?? []) {
        if (f.properties.vehicle_id) vehicleIndex.set(f.properties.vehicle_id, f);
        if (f.properties.gtfs_trip_id) tripIndex.set(f.properties.gtfs_trip_id, f);
    }
    return { vehicleIndex, tripIndex };
};

/** The vehicle running `tripId`, or null when the trip has no live vehicle. */
export const vehicleIdOnTrip = (fleet: VehicleCollection | null, tripId: string | null): string | null => {
    if (!fleet || !tripId) return null;
    for (const f of fleet.features) if (f.properties.gtfs_trip_id === tripId) return f.properties.vehicle_id || null;
    return null;
};
