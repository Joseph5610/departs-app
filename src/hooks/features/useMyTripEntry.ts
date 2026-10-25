import { useTranslation } from 'react-i18next';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useRideStore } from '@/state/rideStore';
import { useUiStore } from '@/state/uiStore';
import type { Departure } from '@/types';

/** Opening a board departure's My trip sheet from its stop, and whether the user already takes it; null without a trip. */
export const useMyTripEntry = (dep: Departure) => {
    const { t } = useTranslation();
    const city = usePreferencesStore(s => s.selectedCity);
    const { openMyTrip } = useUiStore(s => s.actions);
    const isSet = useRideStore(s => !!dep.tripId && s.trips.some(trip => trip.tripId === dep.tripId));
    const stopId = dep.platformStopId ?? dep.stopId;
    if (!dep.tripId || !stopId) return null;
    const tripId = dep.tripId;
    return {
        isSet,
        label: isSet ? t('myTrip.edit') : t('myTrip.take'),
        open: () => openMyTrip({ city, tripId, vehicleId: dep.vehicleId ?? null, stopId }),
    };
};
