import { useRouteParams } from '@/hooks/useRouteParams';
import { useVehicles } from '@/hooks/data/useVehicles';
import { useVehicleDetail } from '@/hooks/data/useVehicleDetail';
import { useRouteMetadata } from '@/hooks/data/useRouteMetadata';
import { useFleetLookup } from '@/hooks/data/useVehicleMetadata';
import { memoizeLast } from '@/lib/memoize';
import { mergeSelectedVehicle as mergeVehicleSources } from '@/domain/vehicles';
import { useEnrichmentStore } from '@/state/enrichmentStore';

const mergeSelectedVehicle = memoizeLast(mergeVehicleSources);

/** The vehicle panel's single object: the route's IDs, live stream and detail API merged by `mergeSelectedVehicle`. */
export const useSelectedVehicle = () => {
    const { tripId, vehicleId } = useRouteParams();

    const { vehicleIndex, tripIndex, dataUpdatedAt: vehiclesUpdatedAt } = useVehicles();
    const { data: vehicleDetail, dataUpdatedAt: detailUpdatedAt } = useVehicleDetail();

    const byTripId = useEnrichmentStore(s => s.byTripId);
    const byVehicleId = useEnrichmentStore(s => s.byVehicleId);
    const { byShortName, byId } = useRouteMetadata();
    const metadata = useFleetLookup()?.(vehicleId ?? vehicleDetail?.vehicle_id);

    return mergeSelectedVehicle(tripId, vehicleId, vehicleIndex, tripIndex, vehicleDetail, byTripId, byVehicleId, byShortName, byId, metadata, vehiclesUpdatedAt, detailUpdatedAt);
};
