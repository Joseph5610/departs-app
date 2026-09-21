import { z } from 'zod';
import type { Env } from '../../_core/types';
import { CACHE_TTL, ERROR_MESSAGES } from '../../_core/config';
import { ApiError } from '../../_core/errors';
import { GOLEMIO_CONFIG } from './config';
import { golemioClient } from './GolemioClient';
import { golemioDepartureItemSchema, type GolemioDepartureItem } from './schemas/departures';

/**
 * Departure boards for groups of platform ids, one board per group in request order. A malformed
 * departure is dropped rather than failing the whole board.
 */
export async function getDepartureBoards(env: Env, stopIdGroups: string[][]): Promise<GolemioDepartureItem[][]> {
    const stopIdsParams = stopIdGroups.map((ids, idx) => JSON.stringify({ [String(idx)]: ids }));

    const response = await golemioClient.fetch("/v2/public/departureboards", env, {
        cacheTtl: CACHE_TTL.DEPARTURES,
        searchParams: {
            "stopIds[]": stopIdsParams,
            limit: GOLEMIO_CONFIG.DEPARTURE_LIMIT.toString(),
            minutesAfter: GOLEMIO_CONFIG.DEPARTURE_MINUTES_AFTER.toString()
        }
    });

    if (!response.ok) {
        const status = (response.status === 404 || response.status === 400) ? response.status : 502;
        const errorMsg = (response.status === 404 || response.status === 400) ? ERROR_MESSAGES.INVALID_STOP_ID : ERROR_MESSAGES.UPSTREAM_ERROR(response.status);
        throw new ApiError(errorMsg, status);
    }

    const rawData = await response.json();

    const safeSchema = z.array(z.array(golemioDepartureItemSchema.nullable().catch(err => {
        console.warn("Skipping invalid departure item:", err);
        return null;
    })));

    const parsed = safeSchema.safeParse(rawData);
    if (!parsed.success) {
        console.error("Critical Golemio structural change:", parsed.error);
        throw new ApiError(ERROR_MESSAGES.UPSTREAM_ERROR(502), 502);
    }

    return parsed.data.map(group => group.filter((item): item is GolemioDepartureItem => item !== null));
}
