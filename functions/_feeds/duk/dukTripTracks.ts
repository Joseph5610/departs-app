import * as z from 'zod/mini';
import type { CityConfig } from '../../_core/cityConfig';
import { appClient } from '../../_core/ApiClient';
import { UPSTREAM_TTL_S, STATIC_DATA_CONFIG } from '../../_core/config';
import { LruCache } from '../../_core/feed/LruCache';
import { MEMORY_CACHE_TTL } from '../../_core/feed/cacheManager';
import type { Schedule } from '../gtfs/schedule';
import { tripBucketId } from '../gtfs/config';
import { isFields, type Fields } from '../../_core/utils/fields';
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
const tracksFileSchema = z.lazy(() => z.object({
    stops: z.custom<unknown[]>((v) => Array.isArray(v) && v.length > 0),
    trips: z.custom<Fields>(isFields),
}));

type RawTrack = [number, number[], number[], number[], number[]];

const isNumbers = (value: unknown): value is number[] => {
    if (!Array.isArray(value)) return false;
    for (const n of value) if (typeof n !== 'number') return false;
    return true;
};

/** `HourTracks` type-checks each trip it reads, which Zod would do for the whole file at several times the cost. */
const isRawTrack = (value: unknown): value is RawTrack =>
    Array.isArray(value) && value.length === 5 && typeof value[0] === 'number'
    && isNumbers(value[1]) && isNumbers(value[2]) && isNumbers(value[3]) && isNumbers(value[4]);

/** Hour files are large, so an isolate keeps only the few it is actually serving from. */
const hourFiles = new LruCache<HourTracks>({
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

/** One hour's trips, decoded as they are asked for: a request reads a few hundred of the file's thousand. */
class HourTracks {
    private readonly decoded = new Map<string, TripTrack | null>();
    readonly isEmpty: boolean;

    constructor(private readonly file?: z.infer<typeof tracksFileSchema>) {
        this.isEmpty = !file || Object.keys(file.trips).length === 0;
    }

    get(tripId: string): TripTrack | undefined {
        let track = this.decoded.get(tripId);
        if (track === undefined) {
            track = this.file ? decode(this.file.stops, this.file.trips[tripId]) : null;
            this.decoded.set(tripId, track);
        }
        return track ?? undefined;
    }
}

const NO_TRACKS = new HourTracks();

function decode(stops: unknown[], raw: unknown): TripTrack | null {
    if (!isRawTrack(raw)) return null;
    const [lastArrivalSecs, stopIdx, secs, lat, lon] = raw;
    // The four arrays describe the same stops, so a short one would silently produce NaN distances.
    if (stopIdx.length === 0 || secs.length !== stopIdx.length || lat.length !== stopIdx.length || lon.length !== stopIdx.length) return null;
    const stopIds: string[] = [];
    for (const i of stopIdx) {
        const id = stops[i];
        if (typeof id !== 'string') return null;
        stopIds.push(id);
    }
    return {
        stopIds,
        lastArrivalSecs,
        departureSecs: fromDeltas(secs),
        lat: fromDeltas(lat, DUK_CONFIG.TRACK_COORD_SCALE),
        lon: fromDeltas(lon, DUK_CONFIG.TRACK_COORD_SCALE),
    };
}

/**
 * The timetable positions of every trip running in one hour of the operating day.
 *
 * Read per trip this is one subrequest per candidate vehicle, which on a fresh isolate runs past the
 * Workers subrequest limit; an hour is a single request of a few hundred kilobytes.
 */
async function loadHour(city: CityConfig, hour: number): Promise<HourTracks> {
    const name = String(hour).padStart(2, '0');
    const cacheKey = `${city.slug}:${name}`;
    const cached = hourFiles.get(cacheKey);
    if (cached) return cached;
    if (failedHours.get(cacheKey)) return NO_TRACKS;

    const res = await appClient.fetch(`${STATIC_DATA_CONFIG.BASE_URL}/${city.slug}/tracks/${name}.json`, {
        cf: { cacheTtl: UPSTREAM_TTL_S.SCHEDULE_DATA }
    }).catch(() => null);
    if (!res || !res.ok) {
        console.warn(`[DUK] No trip tracks for hour ${name}: ${res?.status ?? 'fetch failed'}`);
        failedHours.set(cacheKey, true);
        return NO_TRACKS;
    }

    const parsed = tracksFileSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) {
        console.error(`[DUK] Malformed trip tracks for hour ${name}`);
        failedHours.set(cacheKey, true);
        return NO_TRACKS;
    }

    const tracks = new HourTracks(parsed.data);
    if (!tracks.isEmpty) hourFiles.set(cacheKey, tracks);
    return tracks;
}

/**
 * Reads trips out of the hour files, an hour at a time.
 *
 * A vehicle's trip is usually running now, but one waiting at a terminus belongs to an hour still to
 * come. The first few such trips are left to their own small buckets; only an hour asked for more
 * often is loaded whole, and never more than `TRACK_HOURS_PER_REQUEST` of them.
 */
export class TripTrackLookup {
    /** In-flight loads are shared: every vehicle of a request asks at the same moment. */
    private readonly hours = new Map<number, Promise<HourTracks>>();
    private readonly bucketsRead = new Set<string>();
    /** Trips asked for from each hour not loaded yet. */
    private readonly stragglers = new Map<number, Set<string>>();

    private constructor(
        private readonly city: CityConfig,
        private readonly schedule: Schedule | null,
        private readonly currentHour: number,
        private readonly running: HourTracks
    ) {
        this.hours.set(currentHour, Promise.resolve(running));
    }

    /** Without a schedule nothing can be matched, so no hour is loaded either. */
    static async create(city: CityConfig, schedule: Schedule | null, minutesOfDay: number): Promise<TripTrackLookup> {
        const hour = Math.floor(minutesOfDay / 60);
        return new TripTrackLookup(city, schedule, hour, schedule ? await loadHour(city, hour) : NO_TRACKS);
    }

    /** False means no track data at all, so callers may read trip buckets instead. */
    get isAvailable(): boolean {
        return !this.running.isEmpty;
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

        const window = this.schedule?.trips[tripId];
        if (!window) return null;

        const hour = Math.floor(window[0] / 60) % DUK_CONFIG.HOURS_PER_DAY;
        if (hour === this.currentHour) return null;

        let pending = this.hours.get(hour);
        if (!pending) {
            let waiting = this.stragglers.get(hour);
            if (!waiting) this.stragglers.set(hour, waiting = new Set());
            waiting.add(tripId);
            if (waiting.size <= DUK_CONFIG.TRACK_STRAGGLERS_PER_HOUR || this.hours.size >= DUK_CONFIG.TRACK_HOURS_PER_REQUEST) return null;
            pending = loadHour(this.city, hour);
            this.hours.set(hour, pending);
        }
        return (await pending).get(tripId) ?? null;
    }
}
