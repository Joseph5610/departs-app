import { useRoute } from 'wouter';
import { usePreferencesStore } from '../state/preferencesStore';
import { useEffect } from 'react';
import { useCities } from './data/useCities';

export const useRouteParams = () => {
    const [isStop, stopParams] = useRoute('/:city/stop/:stopId');
    const [isTrip, tripParams] = useRoute('/:city/trip/:tripId');
    const [isTripVehicle, tripVehicleParams] = useRoute('/:city/trip/:tripId/:vehicleId');
    const [isCityBase, cityBaseParams] = useRoute('/:city');

    let city = null;
    let stopId = null;
    let tripId = null;
    let vehicleId = null;

    if (isTripVehicle) {
        city = decodeURIComponent(tripVehicleParams.city);
        tripId = decodeURIComponent(tripVehicleParams.tripId);
        vehicleId = decodeURIComponent(tripVehicleParams.vehicleId);
    } else if (isTrip) {
        city = decodeURIComponent(tripParams.city);
        tripId = decodeURIComponent(tripParams.tripId);
    } else if (isStop) {
        city = decodeURIComponent(stopParams.city);
        stopId = decodeURIComponent(stopParams.stopId);
    } else if (isCityBase) {
        city = decodeURIComponent(cityBaseParams.city);
    }

    const { data: citiesData } = useCities();
    const setSelectedCity = usePreferencesStore(s => s.actions.setSelectedCity);
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    useEffect(() => {
        if (city && city !== selectedCity && city !== 'explorer') {
            // Check if valid city
            const isValidCity = citiesData?.cities.some(c => c.slug === city) ?? true;
            if (isValidCity) {
                setSelectedCity(city);
            }
        }
    }, [city, selectedCity, setSelectedCity, citiesData]);

    return { city, stopId, tripId, vehicleId };
};
