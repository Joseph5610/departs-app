import type { CityConfig } from '../../../_core/cityConfig';
import { getDepartureRows, getStationPlatforms, getStopRelations, type StopRelation } from '../../../_feeds/gtfs/departureRows';
import type { GtfsDepartureTuple } from '../../../_feeds/gtfs/types';
import { boundedStopTargets, checkRequestedStops, type StopTargets } from './stopTargets';


/**
 * A city's static departure data: which platforms a station's departures are attached to, and the
 * timetable rows of a platform. The feed holds both across requests, so building this costs nothing.
 */
export class StopIndex {
    constructor(private readonly city: CityConfig) {}

    /** Each stop the requested values name that the data knows, with its station (a platform) or its platforms (a station). */
    relationsOf(values: string[]): Promise<Map<string, StopRelation>> {
        return getStopRelations(this.city, values);
    }

    /** The platforms of each of `stationIds` that has any. */
    childrenOf(stationIds: string[]): Promise<Map<string, string[]>> {
        return getStationPlatforms(this.city, stationIds);
    }

    /**
     * Expands each requested id into the platforms departures are actually attached to.
     *
     * The request-level cap in `departuresQuerySchema` bounds how many ids may be *named*; this bounds
     * how many they may *expand into*, which is what actually drives subrequest count. A handful of
     * large interchange stations can otherwise produce hundreds of targets from a request that passed
     * the first check.
     */
    async resolve(stopIds: string[]): Promise<StopTargets> {
        checkRequestedStops(stopIds);
        const relations = await getStopRelations(this.city, stopIds);
        return boundedStopTargets(stopIds, relations);
    }

    /** The timetable rows of the given stops; `parentOf` names the station of any that are platforms. */
    rows(stopIds: string[], parentOf: ReadonlyMap<string, string>): Promise<Map<string, GtfsDepartureTuple[]>> {
        return getDepartureRows(this.city, stopIds, parentOf);
    }
}

/** A city's stop index, read from its static data. */
export function getStopIndex(city: CityConfig): StopIndex {
    return new StopIndex(city);
}
