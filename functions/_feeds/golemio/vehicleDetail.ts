import type { Env } from '../../_core/types';
import { CACHE_TTL, ERROR_MESSAGES } from '../../_core/config';
import { ApiError } from '../../_core/errors';
import { golemioClient } from './GolemioClient';
import { golemioVehicleDetailSchema, type GolemioVehicleDetailPayload } from './schemas/vehicles';

/**
 * A trip's detail from Golemio: the live vehicle on it when a vehicle is named and Golemio has it,
 * otherwise the static GTFS trip. `isStatic` says which one answered.
 */
export async function getTripDetail(env: Env, tripId: string, vehicleId: string | null): Promise<{ data: GolemioVehicleDetailPayload; isStatic: boolean }> {
    const scopes = ['info', 'stop_times', 'vehicle_descriptor'];

    const fetchStaticTrip = async () => {
        const res = await golemioClient.fetch(`/v2/public/gtfs/trips/${tripId}`, env, {
            cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
            searchParams: { scopes }
        });
        return { response: res, isStatic: true };
    };

    let response: Response;
    let isStatic = false;

    if (!vehicleId) {
        ({ response, isStatic } = await fetchStaticTrip());
    } else {
        response = await golemioClient.fetch(`/v2/public/vehiclepositions/${vehicleId};gtfsTripId=${tripId}`, env, {
            cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
            searchParams: { scopes }
        });

        if (!response.ok) {
            console.warn(`Real-time fetch failed (${response.status}), falling back to static GTFS for trip ${tripId}`);
            ({ response, isStatic } = await fetchStaticTrip());
        }
    }

    if (!response.ok) {
        throw new ApiError(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), response.status);
    }

    const rawData = await response.json();
    const parsed = golemioVehicleDetailSchema.safeParse(rawData);

    if (!parsed.success) {
        console.error(`Critical Golemio vehicle detail structural change for ${tripId}:`, parsed.error);
        throw new ApiError(ERROR_MESSAGES.UPSTREAM_ERROR(502), 502);
    }

    return { data: parsed.data, isStatic };
}
