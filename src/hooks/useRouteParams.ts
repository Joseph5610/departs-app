import { useRoute } from 'wouter';

export const useRouteParams = () => {
    const [isStop, stopParams] = useRoute('/stop/:stopId');
    const [isTrip, tripParams] = useRoute('/trip/:tripId');
    const [isTripVehicle, tripVehicleParams] = useRoute('/trip/:tripId/:vehicleId');

    const stopId = isStop ? decodeURIComponent(stopParams.stopId) : null;
    let tripId = null;
    let vehicleId = null;

    if (isTripVehicle) {
        tripId = decodeURIComponent(tripVehicleParams.tripId);
        vehicleId = decodeURIComponent(tripVehicleParams.vehicleId);
    } else if (isTrip) {
        tripId = decodeURIComponent(tripParams.tripId);
    }

    return { stopId, tripId, vehicleId };
};
