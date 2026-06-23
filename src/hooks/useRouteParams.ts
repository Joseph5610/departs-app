import { useRoute, useLocation } from 'wouter';
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
    const [, navigate] = useLocation();

    useEffect(() => {
        if (!citiesData?.cities.length) return;

        const validCities = new Set(citiesData.cities.map(c => c.slug));
        const safeCity = validCities.has(selectedCity) ? selectedCity : citiesData.cities[0].slug;

        // 1. Fix persisted store if it holds an invalid city
        if (safeCity !== selectedCity) {
            setSelectedCity(safeCity);
        }

        // 2. Handle URL city validation
        if (!city || city === 'explorer') return;

        if (validCities.has(city)) {
            // Valid city in URL: sync store if needed
            if (city !== safeCity) setSelectedCity(city);
        } else {
            // Invalid city in URL: redirect to safe city
            navigate(`/${safeCity}`, { replace: true });
        }
    }, [city, selectedCity, setSelectedCity, citiesData, navigate]);

    return { city, stopId, tripId, vehicleId };
};
