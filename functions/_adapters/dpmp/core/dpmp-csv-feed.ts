import { z } from 'zod';
import { CacheManager, CACHE_TTL } from '../../../_core/utils/CacheManager';
import { appClient } from '../../../_core/ApiClient';
import type { CityConfig } from '../../../_core/city-config';
import { ApiError } from '../../../_core/errors';
import { DPMP_CONFIG } from './config';

const rowSchema = z.object({
    ROUTE_NUMBER: z.string().trim().min(1),
    PLANNED_START: z.string().trim().regex(/^\d{1,2}:\d{2}$/),
    DIRECTION: z.string().trim(),
    BUS_STOP_ORDER_NUM: z.coerce.number().int().nonnegative(),
    BUS_STOP_NAME_1: z.string().trim(),
    BUS_STOP_NAME_2: z.string().trim(),
    PLANNED_ROAD: z.coerce.number(),
    REAL_ROAD: z.coerce.number(),
    LATITUDE: z.coerce.number().min(-90).max(90),
    LONGITUDE: z.coerce.number().min(-180).max(180),
    VARIATION: z.coerce.number().int(),
    VEHICLE_NUMBER: z.string().trim().min(1),
    DATE_TIME: z.string().trim().min(1),
});

/** One vehicle report from the DPMP realtime CSV. */
export interface DpmpVehicleRow {
    routeNumber: string;
    plannedStart: string;
    direction: string;
    stopOrder: number;
    stopName: string;
    nextStopName: string;
    /** Length in metres of the segment from the current stop to the next one. */
    plannedRoad: number;
    /** Metres travelled since the current stop; 0 while standing at it. */
    realRoad: number;
    /** Null when the vehicle reports no GPS fix (`0;0`); the rest of the row is still live. */
    latitude: number | null;
    longitude: number | null;
    /** Schedule deviation in seconds: positive is ahead of schedule, negative is late. */
    variation: number;
    vehicleNumber: string;
    /** Zone-less local timestamp, `YYYY-MM-DD HH:MM:SS`. */
    dateTime: string;
}

function parseDpmpCsv(text: string): DpmpVehicleRow[] {
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length === 0) return [];

    const header = lines[0].split(DPMP_CONFIG.CSV_DELIMITER).map(h => h.trim());
    const rows: DpmpVehicleRow[] = [];

    for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(DPMP_CONFIG.CSV_DELIMITER);
        const record: Record<string, string> = {};
        for (let c = 0; c < header.length; c++) record[header[c]] = cells[c] ?? '';

        const parsed = rowSchema.safeParse(record);
        if (!parsed.success) continue;

        const r = parsed.data;
        const hasFix = r.LATITUDE !== 0 && r.LONGITUDE !== 0;

        rows.push({
            routeNumber: r.ROUTE_NUMBER.toUpperCase(),
            plannedStart: r.PLANNED_START,
            direction: r.DIRECTION.toUpperCase(),
            stopOrder: r.BUS_STOP_ORDER_NUM,
            stopName: r.BUS_STOP_NAME_1,
            nextStopName: r.BUS_STOP_NAME_2,
            plannedRoad: r.PLANNED_ROAD,
            realRoad: r.REAL_ROAD,
            latitude: hasFix ? r.LATITUDE : null,
            longitude: hasFix ? r.LONGITUDE : null,
            variation: r.VARIATION,
            vehicleNumber: r.VEHICLE_NUMBER,
            dateTime: r.DATE_TIME,
        });
    }

    return rows;
}

/**
 * Fetches, decodes and caches the DPMP realtime CSV, shared by the vehicles and debug paths.
 * Throws when the upstream is unreachable; an empty export (e.g. overnight) is a valid result.
 *
 * @param urlOverride Replaces the configured `realtimeUrl` (the local dev relay).
 */
export async function getDpmpCsvFeed(city: CityConfig, urlOverride?: string): Promise<DpmpVehicleRow[]> {
    const url = urlOverride || city.adapterConfig?.realtimeUrl;
    if (!url) {
        throw new ApiError(`No realtimeUrl configured for city: ${city.slug}`, 501);
    }

    const rows = await CacheManager.getOrFetch<DpmpVehicleRow[] | null>(
        `dpmp_csv_feed_${city.slug}`,
        CACHE_TTL.SHORT_DEBOUNCE_MS,
        async () => {
            const res = await appClient.fetch(url, { cf: { cacheTtl: DPMP_CONFIG.CSV_CACHE_TTL_S } }).catch((err) => {
                console.warn(`[DPMP] Fetch error for ${city.slug}:`, err?.message || err);
                return null;
            });
            if (!res || !res.ok) {
                console.warn(`[DPMP] Failed to fetch CSV for ${city.slug}: ${res?.status}`);
                return null;
            }

            const text = new TextDecoder(DPMP_CONFIG.CSV_ENCODING).decode(await res.arrayBuffer());
            return parseDpmpCsv(text);
        },
        (data) => !data
    );

    if (!rows) {
        throw new ApiError(`DPMP realtime fetch failed for city: ${city.slug}`, 502);
    }

    return rows;
}
