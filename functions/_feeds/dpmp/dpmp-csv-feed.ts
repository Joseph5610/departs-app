import { MEMORY_CACHE_TTL } from '../../_core/feed/CacheManager';
import { createSource, type Snapshot } from '../../_core/feed/source';
import { appClient } from '../../_core/ApiClient';
import type { CityConfig } from '../../_core/city-config';
import { ApiError } from '../../_core/errors';
import { DPMP_CONFIG } from './config';

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

/** A cell as a finite number, as `Number()` reads it (an empty cell is 0); null when it is not one. */
function finite(cell: string): number | null {
    const value = Number(cell);
    return Number.isFinite(value) ? value : null;
}

/** One CSV row, every cell checked as it is read; null when a required cell is missing or malformed. */
function parseRow(column: (name: string) => string): DpmpVehicleRow | null {
    const routeNumber = column('ROUTE_NUMBER').trim();
    const plannedStart = column('PLANNED_START').trim();
    const vehicleNumber = column('VEHICLE_NUMBER').trim();
    const dateTime = column('DATE_TIME').trim();
    const stopOrder = finite(column('BUS_STOP_ORDER_NUM'));
    const plannedRoad = finite(column('PLANNED_ROAD'));
    const realRoad = finite(column('REAL_ROAD'));
    const latitude = finite(column('LATITUDE'));
    const longitude = finite(column('LONGITUDE'));
    const variation = finite(column('VARIATION'));
    if (!routeNumber || !/^\d{1,2}:\d{2}$/.test(plannedStart) || !vehicleNumber || !dateTime) return null;
    if (stopOrder === null || !Number.isInteger(stopOrder) || stopOrder < 0 || plannedRoad === null || realRoad === null) return null;
    if (latitude === null || Math.abs(latitude) > 90 || longitude === null || Math.abs(longitude) > 180) return null;
    if (variation === null || !Number.isInteger(variation)) return null;

    const hasFix = latitude !== 0 && longitude !== 0;
    return {
        routeNumber: routeNumber.toUpperCase(),
        plannedStart,
        direction: column('DIRECTION').trim().toUpperCase(),
        stopOrder,
        stopName: column('BUS_STOP_NAME_1').trim(),
        nextStopName: column('BUS_STOP_NAME_2').trim(),
        plannedRoad,
        realRoad,
        latitude: hasFix ? latitude : null,
        longitude: hasFix ? longitude : null,
        variation,
        vehicleNumber,
        dateTime,
    };
}

/** The export's rows; a malformed row is dropped rather than failing the rest. Read without a per-row schema, which cost more than the parse. */
function parseDpmpCsv(text: string): DpmpVehicleRow[] {
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length === 0) return [];

    const header = new Map(lines[0].split(DPMP_CONFIG.CSV_DELIMITER).map((h, i) => [h.trim(), i]));
    const rows: DpmpVehicleRow[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(DPMP_CONFIG.CSV_DELIMITER);
        const row = parseRow((name) => cells[header.get(name) ?? -1] ?? '');
        if (row) rows.push(row);
    }
    return rows;
}

/**
 * The DPMP realtime CSV as a snapshot, shared by the vehicles and debug paths. A failed read keeps
 * the last good snapshot; null only when there has never been one. An empty export (e.g. overnight)
 * is a valid snapshot.
 *
 * @param urlOverride Replaces the configured `realtimeUrl`; `env.DPMP_REALTIME_URL` points local dev at the Vite relay.
 */
export async function getDpmpCsvSnapshot(city: CityConfig, urlOverride?: string): Promise<Snapshot<DpmpVehicleRow[]> | null> {
    const url = urlOverride || city.feed?.realtimeUrl;
    if (!url) {
        throw new ApiError(`No realtimeUrl configured for city: ${city.slug}`, 501);
    }

    return createSource<DpmpVehicleRow[]>({
        key: `dpmp_csv_feed_${city.slug}`,
        ttlMs: MEMORY_CACHE_TTL.SHORT_DEBOUNCE_MS,
        read: async () => {
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
    })();
}

/** The CSV's rows alone. Throws when the upstream has never been readable. */
export async function getDpmpCsvFeed(city: CityConfig, urlOverride?: string): Promise<DpmpVehicleRow[]> {
    const snapshot = await getDpmpCsvSnapshot(city, urlOverride);
    if (!snapshot) {
        throw new ApiError(`DPMP realtime fetch failed for city: ${city.slug}`, 502);
    }
    return snapshot.data;
}
