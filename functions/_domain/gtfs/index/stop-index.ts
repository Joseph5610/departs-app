import type { CityConfig } from '../../../_core/city-config';
import { ERROR_MESSAGES } from '../../../_core/config';
import { ApiError } from '../../../_core/errors';
import { GTFS_CONFIG } from '../../../_feeds/gtfs/config';
import { getDepartureRows, getParentChildMap } from '../../../_feeds/gtfs/departure-rows';
import type { GtfsDepartureTuple } from '../../../_feeds/gtfs/types';

/** The stop ids a request named, resolved to the platforms whose rows must actually be read. */
export interface StopTargets {
    targetIds: string[];
    childToRequestedMap: Map<string, string>;
}

/**
 * A city's static departure data: which platforms a station's departures are attached to, and the
 * timetable rows of a platform. The feed holds both across requests, so building this costs nothing.
 */
export class StopIndex {
    constructor(private readonly city: CityConfig) {}

    /** Which platforms a station's departures are attached to. */
    parentToChildMap(): Promise<Record<string, string[]>> {
        return getParentChildMap(this.city);
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
        const parentToChildMap = await this.parentToChildMap();
        const targetIds: string[] = [];
        const childToRequestedMap = new Map<string, string>();

        for (const rawId of stopIds) {
            const children = parentToChildMap[rawId];

            if (children && children.length > 0) {
                targetIds.push(...children);
                children.forEach(c => childToRequestedMap.set(c, rawId));
            } else {
                targetIds.push(rawId);
                childToRequestedMap.set(rawId, rawId);
            }

            if (targetIds.length > GTFS_CONFIG.MAX_DEPARTURE_TARGET_STOPS) {
                throw new ApiError(
                    `Too many stops requested; this expands to more than ${GTFS_CONFIG.MAX_DEPARTURE_TARGET_STOPS} platforms.`,
                    400
                );
            }
        }

        return { targetIds, childToRequestedMap };
    }

    /** The timetable rows of the given stops. */
    rows(stopIds: string[]): Promise<Map<string, GtfsDepartureTuple[]>> {
        return getDepartureRows(this.city, stopIds);
    }
}

/** A city's stop index; throws when the city has no static data to build one from. */
export function getStopIndex(city: CityConfig): StopIndex {
    if (!city.feed?.staticDataUrl) throw new ApiError(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);
    return new StopIndex(city);
}
