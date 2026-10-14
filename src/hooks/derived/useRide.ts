import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTripDetail } from '@/hooks/data/useVehicleDetail';
import { networkVehiclesQueryOptions, useEnrichmentPatches } from '@/hooks/data/useVehicles';
import { usePreferencesStore } from '@/state/preferencesStore';
import type { Ride, RideStatus, VehicleCollection, VehicleDetail } from '@/types';
import { liveStopSequence, vehicleIdOnTrip } from '@/domain/vehicles';
import { deriveRide } from '@/domain/rides';
import { applyEnrichment } from '@/domain/realtime';
import { useCityConfig } from '@/hooks/data/useCities';

/** A ride's progress, from its trip's live detail with the live enrichment applied. Null without the ride or once it has expired. */
export const useRideStatus = (ride: Ride | null, now: number): RideStatus | null => {
    const refreshMs = usePreferencesStore(s => s.refreshIntervalS) * 1000;
    const tripId = ride?.tripId ?? null;
    const selectVehicleOnTrip = useCallback((fleet: VehicleCollection | null) => vehicleIdOnTrip(fleet, tripId), [tripId]);
    const { data: vehicleOnTrip } = useQuery({
        ...networkVehiclesQueryOptions(ride?.city ?? '', refreshMs),
        enabled: !!ride && !ride.vehicleId,
        select: selectVehicleOnTrip,
    });
    const { data, isError, dataUpdatedAt } = useTripDetail(ride?.city ?? '', tripId, ride?.vehicleId ?? vehicleOnTrip ?? null);

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
    const { timezone } = useCityConfig(ride?.city);
    return useMemo(() => deriveRide(ride, detail, isError, now, timezone), [ride, detail, isError, now, timezone]);
};
