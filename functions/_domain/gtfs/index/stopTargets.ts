import type { StopRelation } from '../../../_feeds/gtfs/departureRows';
import { GTFS_CONFIG } from '../../../_feeds/gtfs/config';
import { ApiError } from '../../../_core/errors';
import { requestParts } from '../../../_core/utils/stopIds';

/** The stop ids a request named, resolved to the platforms whose rows must actually be read. */
export interface StopTargets {
    targetIds: string[];
    childToRequestedMap: Map<string, string>;
    /** The station of each target that is a platform. */
    parentOf: Map<string, string>;
}


const tooManyStops = () => new ApiError(
    `Too many stops requested; this expands to more than ${GTFS_CONFIG.MAX_DEPARTURE_TARGET_STOPS} platforms.`,
    400
);

/** Rejects a request before any lookup when the ids its values name already exceed the platform cap. */
export function checkRequestedStops(stopIds: readonly string[]): void {
    if (stopIds.flatMap(requestParts).length > GTFS_CONFIG.MAX_DEPARTURE_TARGET_STOPS) throw tooManyStops();
}

/** `stopTargets`, rejected when the stations expand past the platform cap. */
export function boundedStopTargets(stopIds: readonly string[], relations: ReadonlyMap<string, StopRelation>): StopTargets {
    const targets = stopTargets(stopIds, relations);
    if (targets.targetIds.length > GTFS_CONFIG.MAX_DEPARTURE_TARGET_STOPS) throw tooManyStops();
    return targets;
}

/**
 * Expands each requested id into the platforms its departures are attached to, every row tagged with the
 * value the client sent. A comma-joined value is one stop made of several (a platform and its aliases, or the
 * platforms of one direction); a station expands into its platforms, whose rows sit under the station's bucket.
 */
export function stopTargets(stopIds: readonly string[], relations: ReadonlyMap<string, StopRelation>): StopTargets {
    const targetIds: string[] = [];
    const childToRequestedMap = new Map<string, string>();
    const parentOf = new Map<string, string>();

    for (const requested of stopIds) {
        for (const id of requestParts(requested)) {
            const relation = relations.get(id);
            if (relation && relation[0] === null && relation.length > 1) {
                for (const child of relation.slice(1) as string[]) {
                    targetIds.push(child);
                    childToRequestedMap.set(child, requested);
                    parentOf.set(child, id);
                }
            } else {
                targetIds.push(id);
                childToRequestedMap.set(id, requested);
                if (relation?.[0]) parentOf.set(id, relation[0]);
            }
        }
    }
    return { targetIds, childToRequestedMap, parentOf };
}
