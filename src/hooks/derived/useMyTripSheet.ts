import { useMemo } from 'react';
import { MY_TRIP_CONFIG } from '@/config/constants';
import { boardingChoices, boardingSequence, exitChoices, isLeadPossible, tripStartOf, walkLeadMinutes } from '@/domain/rides';
import { departureStopIds, getStopDistanceInfo } from '@/domain/stops';
import { lastStopOf, liveStopSequence } from '@/domain/vehicles';
import { useCityConfig } from '@/hooks/data/useCities';
import { useStops } from '@/hooks/data/useStops';
import { useTripDetail } from '@/hooks/data/useVehicleDetail';
import { useNowEvery } from '@/hooks/useNow';
import { useGeolocationStore } from '@/state/geolocationStore';
import { useRideStore } from '@/state/rideStore';
import type { MyTripTarget } from '@/types';

/**
 * What the My trip sheet offers for a trip: the stops ahead to board at (each with the alert leads left and a lead
 * from the user's walk there), the one the sheet was opened at, the exits, the trip's last stop, and the user's trip
 * on it if they already take it.
 */
export const useMyTripSheet = (target: MyTripTarget) => {
    const { data: detail, isLoading } = useTripDetail(target.city, target.tripId, target.vehicleId);
    const { model } = useStops();
    const { timezone } = useCityConfig(target.city);
    const now = useNowEvery(MY_TRIP_CONFIG.CLOCK_MS);
    const userLocation = useGeolocationStore(s => s.userLocation);
    const existing = useRideStore(s => s.trips.find(trip => trip.tripId === target.tripId) ?? null);

    const current = liveStopSequence(detail);
    const stops = detail?.stop_times?.features;
    const delay = detail?.is_static_fallback ? 0 : detail?.delay;
    const boardings = useMemo(() => (stops ? boardingChoices(stops, current, delay, now, timezone) : []).map(choice => {
        const walk = walkLeadMinutes(getStopDistanceInfo(userLocation, choice.coordinates));
        return { ...choice, walkLead: walk !== null && isLeadPossible(choice.scheduledMs, choice.delaySecs, walk, now) ? walk : null };
    }), [stops, current, delay, now, timezone, userLocation]);
    const openedAt = useMemo(() => {
        if (!stops || !target.stopId) return null;
        return boardingSequence(stops, departureStopIds(model, target.stopId), current);
    }, [stops, target.stopId, model, current]);
    const exits = useMemo(() => (stops ? exitChoices(stops, current ?? 0, delay) : []), [stops, current, delay]);
    const last = stops ? lastStopOf(stops) : null;

    return {
        detail,
        isLoading,
        boardings,
        openedAt,
        exits,
        start: tripStartOf(boardings, current, now),
        lastStop: last ? { sequence: Number(last.properties.stop_sequence), stopName: last.properties.stop_name } : null,
        existing,
    };
};
