import { z } from 'zod';
import type { Env } from '../../_core/types';
import { CACHE_TTL, ERROR_MESSAGES } from '../../_core/config';
import { ApiError } from '../../_core/errors';
import { golemioClient } from './GolemioClient';
import { golemioInfotextSchema, type GolemioInfotext } from './schemas/infotexts';

/** PID's current infotexts; a malformed one is dropped rather than failing the rest. */
export async function getGolemioInfotexts(env: Env): Promise<GolemioInfotext[]> {
    const response = await golemioClient.fetch("/v3/pid/infotexts", env, {
        cacheTtl: CACHE_TTL.INFOTEXTS
    });

    if (!response.ok) {
        throw new ApiError(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), response.status);
    }

    const rawData = await response.json();

    const safeArraySchema = z.array(golemioInfotextSchema.nullable().catch(err => {
        console.warn("Skipping invalid Infotext:", err);
        return null;
    }));

    const parsed = safeArraySchema.safeParse(rawData);
    if (!parsed.success) {
        console.error("Critical Golemio Infotext structural change:", parsed.error);
        throw new ApiError(ERROR_MESSAGES.UPSTREAM_ERROR(502), 502);
    }

    return parsed.data.filter((i): i is NonNullable<typeof i> => i !== null);
}
