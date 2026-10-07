import type { CityConfig } from '../../../_core/cityConfig';
import { ApiError } from '../../../_core/errors';
import { GTFS_CONFIG } from '../../../_feeds/gtfs/config';
import { getDepartureRows, getStopRelations } from '../../../_feeds/gtfs/departureRows';
import type { GtfsDepartureTuple } from '../../../_feeds/gtfs/types';

/** The stop ids a request named, resolved to the platforms whose rows must actually be read. */
export interface StopTargets {
    targetIds: string[];
    childToRequestedMap: Map<string, string>;
    /** The station of each target that is a platform. */
    parentOf: Map<string, string>;
}

/**
 * A city's static departure data: which platforms a station's departures are attached to, and the
 * timetable rows of a platform. The feed holds both across requests, so building this costs nothing.
 */
export class StopIndex {
    constructor(private readonly city: CityConfig) {}

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
        const relations = await getStopRelations(this.city, stopIds);
        const targetIds: string[] = [];
        const childToRequestedMap = new Map<string, string>();
        const parentOf = new Map<string, string>();

        for (const rawId of stopIds) {
            const relation = relations.get(rawId);

            if (relation && relation[0] === null && relation.length > 1) {
                for (let i = 1; i < relation.length; i++) {
                    const child = relation[i] as string;
                    targetIds.push(child);
                    childToRequestedMap.set(child, rawId);
                    parentOf.set(child, rawId);
                }
            } else {
                targetIds.push(rawId);
                childToRequestedMap.set(rawId, rawId);
                if (relation?.[0]) parentOf.set(rawId, relation[0]);
            }

            if (targetIds.length > GTFS_CONFIG.MAX_DEPARTURE_TARGET_STOPS) {
                throw new ApiError(
                    `Too many stops requested; this expands to more than ${GTFS_CONFIG.MAX_DEPARTURE_TARGET_STOPS} platforms.`,
                    400
                );
            }
        }

        return { targetIds, childToRequestedMap, parentOf };
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
