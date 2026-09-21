import type { AppDepartureResponse, AppVehicleCollection, CityRequestContext } from "../../../_core/types";
import type { CityConfig } from '../../../_core/city-config';
import { getGtfsRoutes } from '../../../_feeds/gtfs/gtfs-data';
import { DeparturesMapper } from './DeparturesMapper';
import type { GtfsDepartureTuple } from '../../../_feeds/gtfs/types';
import { ApiError } from '../../../_core/errors';
import { ERROR_MESSAGES } from '../../../_core/config';
import { departuresQuerySchema, parseSearchParams } from '../../../_core/schemas';
import { getStopIndex, type StopIndex } from '../index/stop-index';
import type { VehiclesService } from '../vehicles/VehiclesService';
import type { DeparturesUseCase } from '../../use-cases';

/** Trip ids a board refers to: its own departures, the arrivals they wait for, and their through-running. */
function collectTripIds(deps: { tuple: GtfsDepartureTuple }[]): Set<string> {
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

/** The rows of every target platform, tagged with the stop the client asked for. */
export async function collectDepartureTuples(
    stopIndex: StopIndex,
    targetIds: string[],
    childToRequestedMap: Map<string, string>
): Promise<{ stopId: string; tuple: GtfsDepartureTuple }[]> {
    const rows = await stopIndex.rows(targetIds);
    const allDeps: { stopId: string; tuple: GtfsDepartureTuple }[] = [];
    for (const [id, tuples] of rows) {
        const requestedStopId = childToRequestedMap.get(id) || id;
        for (const tuple of tuples) allDeps.push({ stopId: requestedStopId, tuple });
    }
    return allDeps;
}

/** Live vehicles for a departure board; null when the city has no vehicles service or the read fails. */
export async function boardVehicles(vehiclesService: VehiclesService | undefined, tripIds?: Set<string>): Promise<AppVehicleCollection | null> {
    try {
        if (vehiclesService) {
            return tripIds
                ? await vehiclesService.getLiveVehiclesForTrips(tripIds)
                : await vehiclesService.getCachedMappedVehicles();
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

        const stopIndex = getStopIndex(this.city);

        try {
            const { targetIds, childToRequestedMap } = await stopIndex.resolve(stopIds);
            const allDeps = await collectDepartureTuples(stopIndex, targetIds, childToRequestedMap);

            if (allDeps.length === 0) {
                return { departures: [] };
            }

            const { routes } = await getGtfsRoutes(this.city);
            const rtVehicles = await boardVehicles(this.vehiclesService, collectTripIds(allDeps));

            return { departures: DeparturesMapper.mapDepartures(allDeps, routes, rtVehicles) };
        } catch (e) {
            if (e instanceof ApiError) throw e;
            console.error('Error loading static departures:', e);
            throw new ApiError(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);
        }
    }
}
