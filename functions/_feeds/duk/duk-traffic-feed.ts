import { z } from 'zod';
import { CacheManager, MEMORY_CACHE_TTL } from '../../_core/feed/CacheManager';
import { createSource, type Snapshot } from '../../_core/feed/source';
import { appClient } from '../../_core/ApiClient';
import type { CityConfig } from '../../_core/city-config';
import { ApiError } from '../../_core/errors';
import { bool, isFields, num, str } from '../../_core/utils/fields';
import { DUK_CONFIG } from './config';

/** Shape check only: `toReport` type-checks each field it reads, at a fraction of a per-vehicle schema's cost. */
const trafficSchema = z.object({ VehicleList: z.array(z.unknown()).nullish() });

/** Shape check only: thousands of stations validated field by field cost several times the parse; the loop checks the two it reads. */
const stationsSchema = z.object({ ItemList: z.array(z.unknown()).nullish() });

/** One vehicle report from the Portabo `GetTraffic` feed. */
export interface DukVehicleReport {
    vehicleId: string;
    /** Zero-padded CIS JŘ line number; null for trains and other vehicles without one. */
    lineNumber: string | null;
    /** CIS JŘ trip (spoj) number within the line. */
    tripNumber: number | null;
    lineName: string;
    /** Seconds; positive is late. */
    delay: number | null;
    latitude: number;
    longitude: number;
    bearing: number | null;
    /** The last stop the vehicle reached. */
    stationNode: number | null;
    /** Actual arrival at and scheduled departure from `stationNode`, as epoch ms. */
    stationArrivalMs: number | null;
    stationDepartureMs: number | null;
    finalNode: number | null;
    state: number | null;
    timestamp: string | null;
    isLowFloor: boolean | null;
    isAirConditioned: boolean | null;
    /** The feed's own trip reference, e.g. `CIST-582486-1-234` or `Os-6832-1479`. */
    feedTripId: string | null;
}

/** Epoch ms of a feed timestamp; null for missing values and the feed's `1970-01-01` placeholder. */
function feedTimeMs(value: string | null | undefined): number | null {
    if (!value) return null;
    const ms = Date.parse(value);
    return Number.isNaN(ms) || ms <= 0 ? null : ms;
}

/** DÚK's name for a train line: boards and the official map say U4 where the feed says S4, or nothing. */
function trainLineName(name: string | null | undefined, lineId: number | null | undefined): string {
    const regional = /^S(\d+)$/.exec(name ?? '');
    if (regional) return `${DUK_CONFIG.TRAIN_LINE_PREFIX}${regional[1]}`;
    if (name) return name;
    const { MIN, MAX, OFFSET } = DUK_CONFIG.TRAIN_LINE_IDS;
    if (lineId != null && lineId >= MIN && lineId <= MAX) return `${DUK_CONFIG.TRAIN_LINE_PREFIX}${lineId - OFFSET}`;
    return String(lineId ?? '');
}

/**
 * When the reported position was taken: the activity time, which moves on with every new position.
 * Trains' GPS times are rounded to the minute (often up), so they would tie or reorder positions.
 */
function reportTime(activity: string | null | undefined, gps: string | null | undefined): string | null {
    const ms = feedTimeMs(activity) ?? feedTimeMs(gps);
    return ms !== null && ms <= Date.now() + DUK_CONFIG.MAX_CLOCK_SKEW_MS ? new Date(ms).toISOString() : null;
}

/** One vehicle of the traffic list, every field type-checked as it is read; null without an id or a position. */
function toReport(raw: unknown): DukVehicleReport | null {
    if (!isFields(raw)) return null;
    const id = num(raw.ID);
    const latitude = num(raw.Latitude);
    const longitude = num(raw.Longitude);
    if (id === undefined || !latitude || !longitude) return null;
    const lineId = num(raw.LineID);
    const cisLineId = num(raw.CISLineID);
    const lineName = str(raw.qride_linename);
    const delay = num(raw.Delay);
    return {
        vehicleId: String(id),
        lineNumber: cisLineId ? String(cisLineId).padStart(DUK_CONFIG.LINE_NUMBER_LENGTH, '0') : null,
        tripNumber: num(raw.RouteID) ?? null,
        lineName: cisLineId ? lineName || String(lineId ?? '') : trainLineName(lineName, lineId),
        delay: delay !== undefined ? delay * 60 : null,
        latitude,
        longitude,
        bearing: num(raw.Azimut) || null,
        stationNode: num(raw.StationNode) || null,
        stationArrivalMs: feedTimeMs(str(raw.ArrivalDT)),
        stationDepartureMs: feedTimeMs(str(raw.TODepartureDT)),
        finalNode: num(raw.FinalNode) || null,
        state: num(raw.State) ?? null,
        timestamp: reportTime(str(raw.LastActivityDT), str(raw.GPSPositionDT)),
        isLowFloor: bool(raw.HasLowfloor) ?? null,
        isAirConditioned: bool(raw.isAirConditioned) ?? null,
        feedTripId: str(raw.qride_tripID) || null,
    };
}

/**
 * The Portabo traffic feed as a snapshot, shared by the vehicles, detail and debug paths. A failed
 * read keeps the last good snapshot; null only when there has never been one. An empty list (e.g.
 * overnight) is a valid snapshot.
 */
export async function getDukTrafficSnapshot(city: CityConfig): Promise<Snapshot<DukVehicleReport[]> | null> {
    const baseUrl = city.feed?.baseUrl;
    if (!baseUrl) {
        throw new ApiError(`No baseUrl configured for city: ${city.slug}`, 501);
    }

    return createSource<DukVehicleReport[]>({
        key: `duk_traffic_${city.slug}`,
        ttlMs: MEMORY_CACHE_TTL.SHORT_DEBOUNCE_MS,
        read: async () => {
            const res = await appClient.fetch(`${baseUrl}/GetTraffic/0`, { headers: { Accept: 'application/json' } }).catch((err) => {
                console.warn(`[DUK] Fetch error for ${city.slug}:`, err?.message || err);
                return null;
            });
            if (!res || !res.ok) {
                console.warn(`[DUK] Failed to fetch traffic for ${city.slug}: ${res?.status}`);
                return null;
            }

            const parsed = trafficSchema.safeParse(await res.json());
            if (!parsed.success) return null;

            const out: DukVehicleReport[] = [];
            for (const raw of parsed.data.VehicleList ?? []) {
                const report = toReport(raw);
                if (report) out.push(report);
            }
            return out;
        },
    })();
}

/** The traffic feed's reports alone. Throws when the upstream has never been readable. */
export async function getDukTrafficFeed(city: CityConfig): Promise<DukVehicleReport[]> {
    const snapshot = await getDukTrafficSnapshot(city);
    if (!snapshot) {
        throw new ApiError(`DUK realtime fetch failed for city: ${city.slug}`, 502);
    }
    return snapshot.data;
}

/** Portabo node id -> stop name, used for the headsign of vehicles. Empty when unavailable. */
export async function getDukStationNames(city: CityConfig): Promise<Map<number, string>> {
    const baseUrl = city.feed?.baseUrl;
    if (!baseUrl) return new Map();

    return CacheManager.getOrFetch<Map<number, string>>(
        `duk_station_names_${city.slug}`,
        DUK_CONFIG.STATION_NAMES_TTL_MS,
        async () => {
            const names = new Map<number, string>();
            try {
                const res = await appClient.fetch(`${baseUrl}/GetStations`, { headers: { Accept: 'application/json' } });
                if (!res.ok) return names;
                const parsed = stationsSchema.safeParse(await res.json());
                if (!parsed.success) return names;
                for (const item of parsed.data.ItemList ?? []) {
                    if (typeof item !== 'object' || item === null) continue;
                    const { Node, Name } = item as { Node?: unknown; Name?: unknown };
                    if (typeof Node === 'number' && typeof Name === 'string' && Name && !names.has(Node)) names.set(Node, Name);
                }
            } catch (e) {
                console.warn(`[DUK] Station names fetch failed for ${city.slug}:`, e);
            }
            return names;
        },
        (names) => !names || names.size === 0
    );
}
