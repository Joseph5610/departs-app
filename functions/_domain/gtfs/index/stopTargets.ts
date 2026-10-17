import type { StopRelation } from '../../../_feeds/gtfs/departureRows';

/** The stop ids a request named, resolved to the platforms whose rows must actually be read. */
export interface StopTargets {
    targetIds: string[];
    childToRequestedMap: Map<string, string>;
    /** The station of each target that is a platform. */
    parentOf: Map<string, string>;
}

/** The ids one requested `stopId` value names: a single stop, or a comma-joined list read as one stop. */
export const stopIdParts = (stopId: string): string[] => stopId.split(',').map(id => id.trim()).filter(Boolean);

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
        for (const id of stopIdParts(requested)) {
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
