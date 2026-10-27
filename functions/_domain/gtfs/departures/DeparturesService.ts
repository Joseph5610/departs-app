import type { AppDepartureResponse, AppVehicleCollection, CityRequestContext } from "../../../_core/types";
import type { CityConfig } from '../../../_core/cityConfig';
import { getGtfsRoutes } from '../../../_feeds/gtfs/gtfsData';
import { mapDepartures } from './departuresMapper';
import type { GtfsDepartureTuple } from '../../../_feeds/gtfs/types';
import { ApiError } from '../../../_core/errors';
import { ERROR_MESSAGES } from '../../../_core/config';
import { departuresQuerySchema, parseSearchParams } from '../../../_core/schemas';
import { getDepartureRows } from '../../../_feeds/gtfs/departureRows';
import { resolveStopTargets } from '../index/stopTargets';
import type { VehiclesService } from '../../vehicles/VehiclesService';
import type { DepartureSource } from './departuresMapper';
import type { DeparturesUseCase } from '../../useCases';

/** Trip ids a board refers to: its own departures, the arrivals they wait for, and their through-running. */
export function collectTripIds(deps: { tuple: GtfsDepartureTuple }[]): Set<string> {
    const ids = new Set<string>();
    for (const { tuple } of deps) {
        const [tripId, , , , , , extras] = tuple;
        if (tripId) ids.add(tripId);
        for (const feeder of extras?.feeders ?? []) if (feeder[0]) ids.add(feeder[0]);
        const continuation = extras?.continues?.[0];
        if (continuation) ids.add(continuation);
    }
    return ids;
}

/** The rows of every target platform, tagged with the stop the client asked for and the platform each leaves from. */
export async function collectDepartureTuples(
    city: CityConfig,
    targetIds: string[],
    childToRequestedMap: Map<string, string>,
    parentOf: ReadonlyMap<string, string>
): Promise<DepartureSource[]> {
    const rows = await getDepartureRows(city, targetIds, parentOf);
    const allDeps: DepartureSource[] = [];
    for (const [id, tuples] of rows) {
        const requestedStopId = childToRequestedMap.get(id) || id;
        for (const tuple of tuples) allDeps.push({ stopId: requestedStopId, platformStopId: id, tuple });
    }
    return allDeps;
}

/** Live vehicles for a departure board; null when the city has no vehicles service or the read fails. */
export async function boardVehicles(
    vehiclesService: VehiclesService | undefined,
    tripIds?: Set<string>,
    waitUntil?: (promise: Promise<unknown>) => void
): Promise<AppVehicleCollection | null> {
    try {
        if (vehiclesService) {
            return tripIds
                ? await vehiclesService.getLiveVehiclesForTrips(tripIds, waitUntil)
                : await vehiclesService.getCachedMappedVehicles(waitUntil);
        }
    } catch (e) {
        console.error('Failed to load RT vehicles for departures via service:', e);
    }
    return null;
}

export class DeparturesService implements DeparturesUseCase {
    constructor(
        public readonly city: CityConfig,
        protected vehiclesService?: VehiclesService
    ) {}

    async getDepartures(ctx: CityRequestContext): Promise<AppDepartureResponse> {
        const { stopId: stopIds } = parseSearchParams(ctx.url.searchParams, departuresQuerySchema);

        if (!stopIds || stopIds.length === 0) {
            throw new ApiError(ERROR_MESSAGES.MISSING_PARAMS, 400);
        }

        try {
            const { targetIds, childToRequestedMap, parentOf } = await resolveStopTargets(this.city, stopIds);
            const allDeps = await collectDepartureTuples(this.city, targetIds, childToRequestedMap, parentOf);

            if (allDeps.length === 0) {
                return { departures: [] };
            }

            const { routes } = await getGtfsRoutes(this.city);
            const rtVehicles = await boardVehicles(this.vehiclesService, collectTripIds(allDeps), ctx.waitUntil);

            return { departures: mapDepartures(allDeps, routes, rtVehicles) };
        } catch (e) {
            if (e instanceof ApiError) throw e;
            console.error('Error loading static departures:', e);
            throw new ApiError(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);
        }
    }
}
