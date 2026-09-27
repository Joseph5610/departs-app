import type { Env } from '../../_core/types';
import { CACHE_TTL } from '../../_core/config';
import { getResponseGeneratedAt } from '../../_core/ApiClient';
import { createSource, type Snapshot } from '../../_core/feed/source';
import { golemioClient } from './GolemioClient';
import { golemioVehiclePositionsSchema, type GolemioVehiclePositionsPayload } from './schemas/vehicles';

/** Golemio's vehicle positions as last read: the payload as received, and validated. */
export interface GolemioVehiclePositions {
    payload: unknown;
    data: GolemioVehiclePositionsPayload;
    /** When Golemio generated the answer, from the response headers. */
    generatedAt: string | undefined;
}

const positionsSource = createSource<GolemioVehiclePositions, Env>({
    key: 'golemio_vehicles',
    ttlMs: CACHE_TTL.VEHICLES * 1000,
    isEmpty: (positions) => !positions.data.features || positions.data.features.length === 0,
    read: readVehiclePositions,
});

/**
 * Golemio's vehicle positions, read once per `CACHE_TTL.VEHICLES`; the map view, the stats and the debug feed
 * all read this snapshot. A failed read keeps the last good one; null only when there never was one.
 */
export function getGolemioVehiclePositions(env: Env): Promise<Snapshot<GolemioVehiclePositions> | null> {
    return positionsSource(env);
}

async function readVehiclePositions(env: Env): Promise<GolemioVehiclePositions | null> {
    // Uncached: this only runs when the edge-cached vehicles answer has expired, so any copy of the positions would be at least as old.
    const response = await golemioClient.fetch("/v2/public/vehiclepositions", env, {
        cache: 'no-store'
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

    const parsed = golemioVehiclePositionsSchema.safeParse(payload);
    if (!parsed.success) {
        console.error("Critical Golemio vehicles structural change:", parsed.error);
        return null;
    }

    return { payload, data: parsed.data, generatedAt: getResponseGeneratedAt(response) };
}
