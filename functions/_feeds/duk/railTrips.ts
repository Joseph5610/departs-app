import type { CityConfig } from '../../_core/cityConfig';
import { appClient } from '../../_core/ApiClient';
import { UPSTREAM_TTL_S, STATIC_DATA_CONFIG } from '../../_core/config';
import { MEMORY_CACHE_TTL, getOrFetch } from '../../_core/feed/cacheManager';
import { DAY_SECS, toSecs, type LocalClock } from '../../_core/utils/time';
import { DUK_CONFIG } from './config';

const { RAIL } = DUK_CONFIG;

/** One stop of a train's run, in service-day `HH:MM:SS` that pass 24:00:00 after midnight. */
export interface RailCall {
    name: string;
    /** The network's platform at the station, where the static data ties one to it. */
    stopId: string | null;
    /** `[lon, lat]` */
    coordinates: [number, number];
    /** Empty at the first stop's arrival and the last one's departure. */
    arrival: string;
    departure: string;
}

/** Per train number, `[dayFlags, [stopIndex, arrival, departure][]]` runs. */
type RailRun = [number, [number, string, string][]];

/** Mirrors `RailTripsFile` in departs-data `scripts/lib/contract.ts`, whose build checks it; read without Zod to spare cold-start CPU. */
interface RailTripsFile {
    $days: string[];
    /** `[name, lat, lon, platformId?]` */
    $stops: (string | number)[][];
    trains: Record<string, RailRun[]>;
}

const isRailTripsFile = (value: unknown): value is RailTripsFile => {
    const file = value as Partial<RailTripsFile> | null;
    return !!file && Array.isArray(file.$days) && Array.isArray(file.$stops) && typeof file.trains === 'object' && file.trains !== null;
};


async function getRailBucket(city: CityConfig, bucket: number): Promise<RailTripsFile | null> {
    return getOrFetch<RailTripsFile | null>(
        `duk_rail_trips_${city.slug}_${bucket}`,
        MEMORY_CACHE_TTL.TWO_HOURS_MS,
        async () => {
            const res = await appClient.fetch(`${STATIC_DATA_CONFIG.BASE_URL}/${city.slug}/${RAIL.TRIPS_DIR}/${bucket}.json`, { cf: { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA } }).catch(() => null);
            if (!res || !res.ok) return null;
            const file: unknown = await res.json().catch(() => null);
            return isRailTripsFile(file) ? file : null;
        },
        (file) => !file
    );
}

interface Candidate { run: RailRun; startSecs: number; endSecs: number }

/**
 * The run to show now, on the clock of today's service day: the one under way, else today's next,
 * else the last one to finish. After midnight yesterday's run may still be going.
 */
function currentRun(file: RailTripsFile, runs: RailRun[], clock: LocalClock): RailRun | null {
    const candidates: Candidate[] = [];
    for (const [date, offsetSecs] of [[clock.date, 0], [clock.previousDate, -DAY_SECS]] as const) {
        const day = file.$days.indexOf(date);
        if (day < 0) continue;
        for (const run of runs) {
            const calls = run[1];
            if (!(run[0] & (1 << day)) || calls.length < 2) continue;
            const first = calls[0][2], last = calls[calls.length - 1][1];
            candidates.push({ run, startSecs: toSecs(first) + offsetSecs, endSecs: toSecs(last) + offsetSecs });
        }
    }

    const margin = RAIL.RUN_MARGIN_S;
    let running: Candidate | null = null, next: Candidate | null = null, last: Candidate | null = null;
    for (const c of candidates) {
        if (clock.secs >= c.startSecs - margin && clock.secs <= c.endSecs + margin) {
            if (!running || c.startSecs > running.startSecs) running = c;
        } else if (c.startSecs > clock.secs) {
            if (!next || c.startSecs < next.startSecs) next = c;
        } else if (!last || c.endSecs > last.endSecs) {
            last = c;
        }
    }
    return (running ?? next ?? last)?.run ?? null;
}

/**
 * The stops a train calls at, from the static rail timetable, for the feed's train reference
 * (`Os-6414-1073`). Null when the train is not in it or the data is not published.
 */
export async function getRailCalls(city: CityConfig, feedTripId: string, clock: LocalClock): Promise<RailCall[] | null> {
    const train = RAIL.FEED_TRIP_PATTERN.exec(feedTripId)?.[2];
    if (!train) return null;
    const file = await getRailBucket(city, Number(train) % RAIL.TRIP_BUCKETS);
    const runs = file?.trains[train];
    if (!file || !runs) return null;

    const run = currentRun(file, runs, clock);
    if (!run) return null;

    const calls: RailCall[] = [];
    for (const [stopIndex, arrival, departure] of run[1]) {
        const [name, lat, lon, stopId] = file.$stops[stopIndex] ?? [];
        if (typeof name !== 'string' || typeof lat !== 'number' || typeof lon !== 'number') continue;
        calls.push({ name, stopId: typeof stopId === 'string' ? stopId : null, coordinates: [lon, lat], arrival, departure });
    }
    return calls.length >= 2 ? calls : null;
}
