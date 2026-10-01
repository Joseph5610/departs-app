import { z } from 'zod';
import type { CityConfig } from '../../_core/city-config';
import { appClient } from '../../_core/ApiClient';
import { UPSTREAM_TTL_S } from '../../_core/config';
import { CacheManager, MEMORY_CACHE_TTL } from '../../_core/feed/CacheManager';
import { LruCache } from '../../_core/feed/LruCache';
import { isFields, type Fields } from '../../_core/utils/fields';
import type { LocalClock } from '../../_core/utils/time';
import { DUK_CONFIG } from './config';

const { RAIL } = DUK_CONFIG;

/** One stop of a train's run: timetable times, and the real ones once the train has been there. */
export interface RailCall {
    name: string;
    /** The network's platform at the station, where the static data ties one to it. */
    stopId: string | null;
    /** `[lon, lat]` */
    coordinates: [number, number] | null;
    /** `HH:MM:SS` local; empty at the first stop's arrival and the last one's departure. */
    arrival: string;
    departure: string;
    actualArrival: string;
    actualDeparture: string;
}

/** A `stophistory` row; times are local `YYYY-MM-DD HH:MM:SS`, empty when not applicable or not yet real. */
const rowSchema = z.object({
    tripstartdate: z.string(),
    stopid: z.string(),
    tripstopindex: z.coerce.number(),
    arrivedat: z.string(),
    shouldarriveat: z.string(),
    departedat: z.string(),
    shoulddepartat: z.string(),
    stopped: z.string(),
});
type Row = z.infer<typeof rowSchema>;

/** Shape check only: `railStopOf` type-checks the one entry it reads. */
const railStopsSchema = z.custom<Fields>(isFields);

const histories = new LruCache<{ calls: RailCall[] | null }>({ maxEntries: RAIL.CACHE_MAX_ENTRIES, ttlMs: RAIL.CACHE_TTL_MS });

/** Set while the history source is failing, so a small volunteer-run server is not asked again by every detail poll. */
const outages = new LruCache<true>({ maxEntries: 1, ttlMs: RAIL.OUTAGE_TTL_MS });

const ymd = (date: string) => `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
const clockTime = (dateTime: string) => dateTime.slice(RAIL.TIME_OFFSET, RAIL.TIME_OFFSET + RAIL.TIME_LENGTH);

/** The feed's train reference (`Os-6414-1073`) as the history source keys trips (`-CZTRAINT-Os-6414`). */
function historyTripId(feedTripId: string): string | null {
    const train = RAIL.FEED_TRIP_PATTERN.exec(feedTripId);
    return train ? `${RAIL.TRIP_PREFIX}${train[1]}-${train[2]}` : null;
}

function parseRows(csv: string): Row[] {
    const lines = csv.split('\n');
    const columns = (lines[0] ?? '').trim().split(',');
    const rows: Row[] = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].trim().split(',');
        if (values.length !== columns.length) continue;
        const parsed = rowSchema.safeParse(Object.fromEntries(columns.map((column, c) => [column, values[c]])));
        if (parsed.success) rows.push(parsed.data);
    }
    return rows;
}

/** Railway stops by SR70 number, as departs-data publishes them; null before that file is rolled out. */
async function getRailStops(city: CityConfig): Promise<Fields | null> {
    const staticDataUrl = city.feed?.staticDataUrl;
    if (!staticDataUrl) return null;
    return CacheManager.getOrFetch<Fields | null>(
        `duk_rail_stops_${city.slug}`,
        MEMORY_CACHE_TTL.TWO_HOURS_MS,
        async () => {
            const res = await appClient.fetch(`${staticDataUrl}/${city.slug}/${RAIL.STOPS_FILE}`, { cf: { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA } }).catch(() => null);
            if (!res || !res.ok) return null;
            const parsed = railStopsSchema.safeParse(await res.json().catch(() => null));
            return parsed.success ? parsed.data : null;
        },
        (stops) => !stops
    );
}

function toCall(row: Row, stops: Fields): RailCall | null {
    const stop = stops[row.stopid.slice(RAIL.STOP_PREFIX.length)];
    if (!Array.isArray(stop)) return null;
    const [name, lat, lon, stopId] = stop as unknown[];
    if (typeof name !== 'string') return null;
    return {
        name,
        stopId: typeof stopId === 'string' ? stopId : null,
        coordinates: typeof lat === 'number' && typeof lon === 'number' ? [lon, lat] : null,
        arrival: clockTime(row.shouldarriveat),
        departure: clockTime(row.shoulddepartat),
        actualArrival: clockTime(row.arrivedat),
        actualDeparture: clockTime(row.departedat),
    };
}

/** A local `YYYY-MM-DD HH:MM:SS` as a number that orders and subtracts like the clock it was read from. */
const clockMs = (dateTime: string) => Date.parse(`${dateTime.replace(' ', 'T')}Z`);

/**
 * The run to show now: a train number runs every day, and after midnight yesterday's may still be
 * going while today's has not set out.
 */
function currentRun(rows: Row[], today: string, nowMs: number): Row[] {
    const byDate = new Map<string, Row[]>();
    for (const row of rows) {
        const run = byDate.get(row.tripstartdate);
        if (run) run.push(row);
        else byDate.set(row.tripstartdate, [row]);
    }
    for (const run of byDate.values()) run.sort((a, b) => a.tripstopindex - b.tripstopindex);

    const todays = byDate.get(today);
    if (todays?.some(row => row.shoulddepartat && clockMs(row.shoulddepartat) <= nowMs)) return todays;

    const lateLimitMs = nowMs - DUK_CONFIG.MAX_LATE_END_MINS * 60_000;
    let earlier: Row[] | undefined;
    for (const [date, run] of byDate) {
        if (date === today) continue;
        const end = run[run.length - 1].shouldarriveat;
        if (end && clockMs(end) >= lateLimitMs) return run;
        earlier = run;
    }
    // Today's run is listed only once it nears; until then the last one's timetable stands in, without its real times.
    return todays ?? earlier?.map(row => ({ ...row, arrivedat: '', departedat: '' })) ?? [];
}

/**
 * The stops a train calls at, with timetable and real times, for a train the timetable data does
 * not cover. Null when the history source does not know the train, is down, or its stops are not
 * published yet.
 */
export async function getRailCalls(city: CityConfig, feedTripId: string, clock: LocalClock): Promise<RailCall[] | null> {
    const historyUrl = city.feed?.railHistoryUrl;
    const tripId = historyTripId(feedTripId);
    if (typeof historyUrl !== 'string' || !tripId) return null;

    const cacheKey = `${city.slug}:${tripId}`;
    const cached = histories.get(cacheKey);
    if (cached) return cached.calls;

    if (outages.get(city.slug)) return null;
    const stops = await getRailStops(city);
    if (!stops) return null;

    const today = ymd(clock.date);
    const res = await appClient.fetch(`${historyUrl}/stophistory`, {
        searchParams: { tripIdLike: tripId, fromDate: ymd(clock.previousDate), toDate: today },
        timeoutMs: RAIL.TIMEOUT_MS,
        cf: { cacheTtl: RAIL.CACHE_TTL_MS / 1000 },
    }).catch(() => null);
    if (!res || !res.ok) {
        console.warn(`[DUK] Rail history unavailable: ${res?.status ?? 'fetch failed'}`);
        outages.set(city.slug, true);
        return null;
    }

    const run = currentRun(parseRows(await res.text()), today, clockMs(`${today} 00:00:00`) + clock.secs * 1000);

    const calls: RailCall[] = [];
    for (const row of run) {
        if (row.stopped !== RAIL.STOPPED) continue;
        const call = toCall(row, stops);
        if (call) calls.push(call);
    }
    const result = calls.length >= 2 ? calls : null;
    histories.set(cacheKey, { calls: result });
    return result;
}
