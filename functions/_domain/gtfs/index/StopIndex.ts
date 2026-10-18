import type { CityConfig } from '../../../_core/cityConfig';
import { getDepartureRows, getStopRelations, type StopRelation } from '../../../_feeds/gtfs/departureRows';
import type { GtfsDepartureTuple } from '../../../_feeds/gtfs/types';
import { boundedStopTargets, requestedStopParts, type StopTargets } from './stopTargets';

export type { StopTargets } from './stopTargets';

/**
 * A city's static departure data: which platforms a station's departures are attached to, and the
 * timetable rows of a platform. The feed holds both across requests, so building this costs nothing.
 */
export class StopIndex {
    constructor(private readonly city: CityConfig) {}

    /** Each of `stopIds` the data knows, with its station (a platform) or its platforms (a station). */
    relationsOf(stopIds: string[]): Promise<Map<string, StopRelation>> {
        return getStopRelations(this.city, stopIds);
    }

    /** The platforms of each of `stationIds` that has any. */
    async childrenOf(stationIds: string[]): Promise<Map<string, string[]>> {
        const children = new Map<string, string[]>();
        for (const [id, relation] of await getStopRelations(this.city, stationIds)) {
            if (relation[0] === null) children.set(id, relation.slice(1) as string[]);
        }
        return children;
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
        const relations = await getStopRelations(this.city, requestedStopParts(stopIds));
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
