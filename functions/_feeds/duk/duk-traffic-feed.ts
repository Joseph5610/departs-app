import { z } from 'zod';
import { CacheManager, MEMORY_CACHE_TTL } from '../../_core/feed/CacheManager';
import { createSource, type Snapshot } from '../../_core/feed/source';
import { appClient } from '../../_core/ApiClient';
import type { CityConfig } from '../../_core/city-config';
import { ApiError } from '../../_core/errors';
import { DUK_CONFIG } from './config';

const vehicleSchema = z.object({
    ID: z.number(),
    Delay: z.number().nullish(),
    LineID: z.number().nullish(),
    RouteID: z.number().nullish(),
    CISLineID: z.number().nullish(),
    HasLowfloor: z.boolean().nullish(),
    isAirConditioned: z.boolean().nullish(),
    Latitude: z.number().nullish(),
    Longitude: z.number().nullish(),
    StationNode: z.number().nullish(),
    FinalNode: z.number().nullish(),
    ArrivalDT: z.string().nullish(),
    TODepartureDT: z.string().nullish(),
    State: z.number().nullish(),
    Azimut: z.number().nullish(),
    LastActivityDT: z.string().nullish(),
    GPSPositionDT: z.string().nullish(),
    qride_tripID: z.string().nullish(),
    qride_linename: z.string().nullish(),
});

const trafficSchema = z.object({ VehicleList: z.array(z.unknown()).nullish() });

const stationsSchema = z.object({
    ItemList: z.array(z.object({ Node: z.number(), Name: z.string().nullish() })).nullish(),
});

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

function toReport(v: z.infer<typeof vehicleSchema>): DukVehicleReport | null {
    if (!v.Latitude || !v.Longitude) return null;
    return {
        vehicleId: String(v.ID),
        lineNumber: v.CISLineID ? String(v.CISLineID).padStart(DUK_CONFIG.LINE_NUMBER_LENGTH, '0') : null,
        tripNumber: v.RouteID ?? null,
        lineName: v.CISLineID ? v.qride_linename || String(v.LineID ?? '') : trainLineName(v.qride_linename, v.LineID),
        delay: typeof v.Delay === 'number' ? v.Delay * 60 : null,
        latitude: v.Latitude,
        longitude: v.Longitude,
        bearing: v.Azimut || null,
        stationNode: v.StationNode || null,
        stationArrivalMs: feedTimeMs(v.ArrivalDT),
        stationDepartureMs: feedTimeMs(v.TODepartureDT),
        finalNode: v.FinalNode || null,
        state: v.State ?? null,
        timestamp: reportTime(v.LastActivityDT, v.GPSPositionDT),
        isLowFloor: v.HasLowfloor ?? null,
        isAirConditioned: v.isAirConditioned ?? null,
        feedTripId: v.qride_tripID || null,
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
                const vehicle = vehicleSchema.safeParse(raw);
                if (!vehicle.success) continue;
                const report = toReport(vehicle.data);
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
                    if (item.Name && !names.has(item.Node)) names.set(item.Node, item.Name);
                }
            } catch (e) {
                console.warn(`[DUK] Station names fetch failed for ${city.slug}:`, e);
            }
            return names;
        },
        (names) => !names || names.size === 0
    );
}
