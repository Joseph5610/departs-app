import type { Env } from '../../_core/types';
import { CACHE_TTL } from '../../_core/config';
import { getResponseGeneratedAt } from '../../_core/ApiClient';
import { createSource, type Snapshot } from '../../_core/feed/source';
import { golemioClient } from './GolemioClient';
import { golemioFleetSchema, type GolemioFleetPayload } from './schemas/vehicles';

/** The whole Prague fleet as last read: Golemio's payload as received, and validated. */
export interface GolemioFleet {
    payload: unknown;
    data: GolemioFleetPayload;
    /** When Golemio generated the answer, from the response headers. */
    generatedAt: string | undefined;
}

const fleetSource = createSource<GolemioFleet, Env>({
    key: 'golemio_vehicles',
    ttlMs: CACHE_TTL.VEHICLES * 1000,
    isEmpty: (fleet) => !fleet.data.features || fleet.data.features.length === 0,
    read: readFleet,
});

/**
 * The Prague fleet, read once per `CACHE_TTL.VEHICLES`; the map view, the stats and the debug feed
 * all read this snapshot. A failed read keeps the last good one; null only when there never was one.
 */
export function getGolemioFleet(env: Env): Promise<Snapshot<GolemioFleet> | null> {
    return fleetSource(env);
}

async function readFleet(env: Env): Promise<GolemioFleet | null> {
    const response = await golemioClient.fetch("/v2/public/vehiclepositions", env, {
        cacheTtl: CACHE_TTL.VEHICLES
    }).catch((error: unknown) => {
        console.error(`Golemio vehicles feed is down`, error);
        return null;
    });

    if (!response || !response.ok) {
        if (response) console.error(`Golemio returned ${response.status} for vehicles feed.`);
        return null;
    }

    const payload: unknown = await response.json().catch((error: unknown) => {
        console.error("Golemio vehicles feed returned invalid JSON", error);
        return null;
    });
    if (payload === null) return null;

    const parsed = golemioFleetSchema.safeParse(payload);
    if (!parsed.success) {
        console.error("Critical Golemio vehicles structural change:", parsed.error);
        return null;
    }

    return { payload, data: parsed.data, generatedAt: getResponseGeneratedAt(response) };
}
