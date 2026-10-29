import { useMemo, useState } from 'react';
import { useTripDetail } from '@/hooks/data/useVehicleDetail';
import { useEnrichmentPatches } from '@/hooks/data/useVehicles';
import { usePreferencesStore } from '@/state/preferencesStore';
import type { MyTrip, MyTripStatus, Ride, VehicleDetail } from '@/types';
import { deriveMyTrip } from '@/domain/rides';
import { applyEnrichment } from '@/domain/realtime';
import { useCityConfig } from '@/hooks/data/useCities';
import { liveStopSequence } from '@shared/rides';

/** A ride's trip detail, live enrichment applied, bridging a dropped vehicle or failed refresh with the last live one. */
const useRideDetail = (ride: Ride | null) => {
    const tripId = ride?.tripId ?? null;
    // Without a vehicle the detail API finds the one running the trip.
    const { data, isError, dataUpdatedAt } = useTripDetail(ride?.city ?? '', tripId, ride?.vehicleId ?? null);

    // The last live detail stands in when the feed drops the vehicle (timetable fallback, delay lost) or a refresh fails,
    // so a late vehicle isn't taken as arrived on its scheduled time.
    const [lastLive, setLastLive] = useState<VehicleDetail | undefined>(undefined);
    const [seenData, setSeenData] = useState(data);
    if (data !== seenData) {
        setSeenData(data);
        if (data && liveStopSequence(data) !== null) setLastLive(data);
    }
    const sameTripLive = lastLive && lastLive.gtfs_trip_id === tripId ? lastLive : undefined;
    const fetched = sameTripLive && (!data || data.is_static_fallback) ? sameTripLive : data;
    // Patches are the selected city's, so a ride in another city keeps its fetched delay.
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { byTripId, byVehicleId } = useEnrichmentPatches(ride?.city === selectedCity);
    const detail = useMemo(
        () => fetched && ride?.city === selectedCity ? applyEnrichment(fetched, fetched.gtfs_trip_id, fetched.vehicle_id, byTripId, byVehicleId, dataUpdatedAt) : fetched,
        [fetched, ride?.city, selectedCity, byTripId, byVehicleId, dataUpdatedAt],
    );
    return { detail, isError };
};

/** A My trip's state, boarding countdown or ride; null without the trip or once it is over. */
export const useMyTripStatus = (trip: MyTrip | null, now: number): MyTripStatus | null => {
    const { detail, isError } = useRideDetail(trip);
    const { timezone } = useCityConfig(trip?.city);
    return useMemo(() => (trip ? deriveMyTrip(trip, detail, isError, now, timezone) : null), [trip, detail, isError, now, timezone]);
};
