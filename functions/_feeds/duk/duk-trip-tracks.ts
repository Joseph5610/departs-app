import { z } from 'zod';
import type { CityConfig } from '../../_core/city-config';
import { appClient } from '../../_core/ApiClient';
import { UPSTREAM_TTL_S } from '../../_core/config';
import { LruCache } from '../../_core/feed/LruCache';
import { MEMORY_CACHE_TTL } from '../../_core/feed/CacheManager';
import type { TripWindows } from '../gtfs/trip-windows';
import { tripBucketId } from '../gtfs/config';
import { DUK_CONFIG } from './config';

/** Where a trip's timetable puts it: one entry per located stop, in travel order, absolute values. */
export interface TripTrack {
    stopIds: string[];
    /** Position of each entry in the trip's full stop list; only set when read from a trip bucket. */
    sequence?: number[];
    lastArrivalSecs: number;
    departureSecs: number[];
    lat: number[];
    lon: number[];
}

/** Shape check only: validating a thousand trips field by field costs more CPU than a request has. */
const tracksFileSchema = z.object({
    stops: z.array(z.string()).min(1),
    trips: z.record(z.string(), z.tuple([z.number(), z.array(z.number()), z.array(z.number()), z.array(z.number()), z.array(z.number())])),
});

/** Hour files are large, so an isolate keeps only the few it is actually serving from. */
const hourFiles = new LruCache<Map<string, TripTrack>>({
    maxEntries: DUK_CONFIG.TRACK_HOURS_CACHED,
    ttlMs: MEMORY_CACHE_TTL.TWO_HOURS_MS,
});

/** An hour that just failed is not asked for again on the next poll. */
const failedHours = new LruCache<true>({
    maxEntries: DUK_CONFIG.HOURS_PER_DAY,
    ttlMs: DUK_CONFIG.TRACK_FAILURE_TTL_MS,
});

const fromDeltas = (values: number[], scale = 1): number[] => {
    const out = new Array<number>(values.length);
    let running = 0;
    for (let i = 0; i < values.length; i++) {
        running += values[i];
        out[i] = running / scale;
    }
    return out;
};

function decode(file: z.infer<typeof tracksFileSchema>): Map<string, TripTrack> {
    const tracks = new Map<string, TripTrack>();
    for (const tripId in file.trips) {
        const [lastArrivalSecs, stopIdx, secs, lat, lon] = file.trips[tripId];
        // The four arrays describe the same stops, so a short one would silently produce NaN distances.
        if (stopIdx.length === 0 || secs.length !== stopIdx.length || lat.length !== stopIdx.length || lon.length !== stopIdx.length) continue;
        const stopIds = stopIdx.map(i => file.stops[i]);
        if (stopIds.some(id => id === undefined)) continue;
        tracks.set(tripId, {
            stopIds,
            lastArrivalSecs,
            departureSecs: fromDeltas(secs),
            lat: fromDeltas(lat, DUK_CONFIG.TRACK_COORD_SCALE),
            lon: fromDeltas(lon, DUK_CONFIG.TRACK_COORD_SCALE),
        });
    }
    return tracks;
}

/**
 * The timetable positions of every trip running in one hour of the operating day.
 *
 * Read per trip this is one subrequest per candidate vehicle, which on a fresh isolate runs past the
 * Workers subrequest limit; an hour is a single request of a few hundred kilobytes.
 */
async function loadHour(city: CityConfig, hour: number): Promise<Map<string, TripTrack>> {
    const staticDataUrl = city.feed?.staticDataUrl;
    if (!staticDataUrl) return new Map();

    const name = String(hour).padStart(2, '0');
    const cacheKey = `${city.slug}:${name}`;
    const cached = hourFiles.get(cacheKey);
    if (cached) return cached;
    if (failedHours.get(cacheKey)) return new Map();

    const res = await appClient.fetch(`${staticDataUrl}/${city.slug}/tracks/${name}.json`, {
        cf: { cacheTtl: UPSTREAM_TTL_S.SCHEDULE_DATA }
    }).catch(() => null);
    if (!res || !res.ok) {
        console.warn(`[DUK] No trip tracks for hour ${name}: ${res?.status ?? 'fetch failed'}`);
        failedHours.set(cacheKey, true);
        return new Map();
    }

    const parsed = tracksFileSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) {
        console.error(`[DUK] Malformed trip tracks for hour ${name}`);
        failedHours.set(cacheKey, true);
        return new Map();
    }

    const tracks = decode(parsed.data);
    if (tracks.size > 0) hourFiles.set(cacheKey, tracks);
    return tracks;
}

/**
 * Reads trips out of the hour files, an hour at a time.
 *
 * A vehicle's trip is usually running now, but one waiting at a terminus belongs to an hour still to
 * come, so those hours are loaded too. Bounded twice over: a request only asks for the hours its own
 * vehicles are scheduled in, and never for more than `TRACK_HOURS_PER_REQUEST` of them.
 */
export class TripTrackLookup {
    /** In-flight loads are shared: every vehicle of a request asks at the same moment. */
    private readonly hours = new Map<number, Promise<Map<string, TripTrack>>>();
    private readonly bucketsRead = new Set<string>();

    private constructor(
        private readonly city: CityConfig,
        private readonly windows: TripWindows | null,
        private readonly currentHour: number,
        private readonly running: Map<string, TripTrack>
    ) {
        this.hours.set(currentHour, Promise.resolve(running));
    }

    /** Without trip windows nothing can be matched, so no hour is loaded either. */
    static async create(city: CityConfig, windows: TripWindows | null, minutesOfDay: number): Promise<TripTrackLookup> {
        const hour = Math.floor(minutesOfDay / 60);
        return new TripTrackLookup(city, windows, hour, windows ? await loadHour(city, hour) : new Map());
    }

    /** False means no track data at all, so callers may read trip buckets instead. */
    get isAvailable(): boolean {
        return this.running.size > 0;
    }

    /**
     * Whether this request may still read a trip from its own bucket.
     *
     * The hour files exist so a request does not make one subrequest per candidate trip. Stragglers
     * - a trip the file does not carry, or the whole file missing before a data rollout - are still
     * read from their buckets, but only from so many distinct ones, since that is what costs a
     * subrequest. A bucket already read is free.
     */
    allowBucketRead(tripId: string): boolean {
        const bucket = tripBucketId(tripId);
        if (this.bucketsRead.has(bucket)) return true;
        if (this.bucketsRead.size >= DUK_CONFIG.TRACK_BUCKETS_PER_REQUEST) return false;
        this.bucketsRead.add(bucket);
        return true;
    }

    async get(tripId: string): Promise<TripTrack | null> {
        const now = this.running.get(tripId);
        if (now) return now;
        if (!this.isAvailable) return null;

        const window = this.windows?.trips[tripId];
        if (!window) return null;

        const hour = Math.floor(window[0] / 60) % DUK_CONFIG.HOURS_PER_DAY;
        if (hour === this.currentHour) return null;

        let pending = this.hours.get(hour);
        if (!pending) {
            if (this.hours.size >= DUK_CONFIG.TRACK_HOURS_PER_REQUEST) return null;
            pending = loadHour(this.city, hour);
            this.hours.set(hour, pending);
        }
        return (await pending).get(tripId) ?? null;
    }
}
