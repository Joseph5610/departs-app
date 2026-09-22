import { z } from 'zod';
import { appClient } from '../../_core/ApiClient';
import type { CityConfig } from '../../_core/city-config';
import { LruCache } from '../../_core/feed/LruCache';
import { DUK_CONFIG } from './config';

const departureSchema = z.object({
    LineName: z.union([z.string(), z.number()]).transform(String),
    Direction: z.string().nullish(),
    StationPost: z.number().nullish(),
    DepartureTimeOnlyByTO: z.boolean().nullish(),
    TODepartureDT: z.string(),
    DepartureDT: z.string().nullish(),
    Delay: z.string().nullish(),
    Traction: z.number().nullish(),
    informations: z.array(z.string()).nullish(),
});

const boardSchema = z.object({ DeparturesList: z.array(z.unknown()).nullish() });

/** One departure from a Portabo station board. */
export interface DukBoardDeparture {
    line: string;
    direction: string;
    /** Portabo post; `VIRTUAL_POST` when the board does not know the platform. */
    post: string | null;
    scheduledMs: number;
    expectedMs: number;
    /** Seconds; null when the time is timetable-only, without live tracking. */
    delay: number | null;
    traction: number | null;
    notes: string[];
}

/** Boards per node and post, bounded because the keyspace grows with every stop a user opens. */
const boardCache = new LruCache<{ board: DukBoardDeparture[]; fetchedAt: number }>({
    maxEntries: DUK_CONFIG.BOARD_CACHE_MAX_ENTRIES,
    ttlMs: DUK_CONFIG.BOARD_MAX_STALE_MS,
});

/**
 * Lines a station's own platform boards never list, which Portabo only ever reports on its virtual
 * post (Most's trams). Reading it costs one board per platform, so it is surveyed in the background
 * and kept for hours: which operator gets a platform changes with the timetable, not during the day.
 */
const unplacedLinesCache = new LruCache<string[]>({
    maxEntries: DUK_CONFIG.BOARD_CACHE_MAX_ENTRIES,
    ttlMs: DUK_CONFIG.UNPLACED_LINES_TTL_MS,
});

/**
 * Started-at per node under survey. A `waitUntil` task killed or cancelled mid-flight never reaches
 * its `finally`, so a bare in-flight flag would wedge that station's survey for the isolate's life;
 * an entry older than `UNPLACED_SURVEY_ABANDON_MS` is treated as orphaned and retried instead.
 */
const surveysInFlight = new Map<string, number>();

/** `H:MM:SS`, optionally negative, to seconds. */
function parseDelay(value: string | null | undefined): number | null {
    const m = /^(-)?(\d+):(\d{2}):(\d{2})$/.exec(value?.trim() ?? '');
    if (!m) return null;
    const secs = Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4]);
    return m[1] ? -secs : secs;
}

/**
 * A Portabo station board: the authoritative DÚK departures, including trains and trolleybuses,
 * with live delays. Post `0` is the whole station, any other post that platform only. Null when the
 * upstream fails. Portabo needs seconds for a busy station, so a board held past `BOARD_FRESH_MS`
 * is still answered with and refreshed through `schedule` (the request's `waitUntil`) where given.
 */
export async function getDukStationBoard(
    city: CityConfig,
    node: string,
    post: string,
    schedule?: (task: Promise<unknown>) => void
): Promise<DukBoardDeparture[] | null> {
    const cacheKey = `${city.slug}:${node}:${post}`;
    const cached = boardCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < DUK_CONFIG.BOARD_FRESH_MS) return cached.board;
    if (cached && schedule) {
        schedule(loadBoard(city, node, post, cacheKey));
        return cached.board;
    }
    return loadBoard(city, node, post, cacheKey);
}

/** An empty board is Portabo's answer, not a failure; only an unreachable upstream is retried. */
async function loadBoard(city: CityConfig, node: string, post: string, cacheKey: string): Promise<DukBoardDeparture[] | null> {
    const baseUrl = city.feed?.baseUrl;
    if (typeof baseUrl !== 'string') return null;

    for (let attempt = 1; attempt <= DUK_CONFIG.BOARD_FETCH_ATTEMPTS; attempt++) {
        const board = await fetchBoard(baseUrl, node, post);
        if (board) {
            boardCache.set(cacheKey, { board, fetchedAt: Date.now() });
            return board;
        }
    }
    return null;
}

async function fetchBoard(baseUrl: string, node: string, post: string): Promise<DukBoardDeparture[] | null> {
    try {
        const res = await appClient.fetch(`${baseUrl}/GetStationDeparturesWCount/${encodeURIComponent(node)}/${encodeURIComponent(post)}/${DUK_CONFIG.BOARD_DEPARTURE_COUNT}/0`, {
            timeoutMs: DUK_CONFIG.BOARD_TIMEOUT_MS,
            headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
            console.warn(`[DUK] Board fetch failed for node ${node}: ${res.status}`);
            return null;
        }
        const parsed = boardSchema.safeParse(await res.json());
        if (!parsed.success) return null;

        const board: DukBoardDeparture[] = [];
        for (const raw of parsed.data.DeparturesList ?? []) {
            const dep = departureSchema.safeParse(raw);
            if (!dep.success) continue;
            const d = dep.data;
            const scheduledMs = Date.parse(d.TODepartureDT);
            if (Number.isNaN(scheduledMs)) continue;
            const expectedMs = d.DepartureDT ? Date.parse(d.DepartureDT) : NaN;
            const isLive = d.DepartureTimeOnlyByTO === false;
            board.push({
                line: d.LineName.trim(),
                direction: d.Direction?.trim() ?? '',
                post: d.StationPost == null ? null : String(d.StationPost),
                scheduledMs,
                expectedMs: Number.isNaN(expectedMs) ? scheduledMs : expectedMs,
                delay: isLive ? parseDelay(d.Delay) : null,
                traction: d.Traction ?? null,
                notes: d.informations ?? [],
            });
        }
        return board;
    } catch (e) {
        console.warn(`[DUK] Board fetch error for node ${node}:`, e);
        return null;
    }
}

/** The lines this station only ever shows on the virtual post, or null until the survey has run. */
export function getDukUnplacedLines(city: CityConfig, node: string): Set<string> | null {
    const lines = unplacedLinesCache.get(`${city.slug}:${node}`);
    return lines === undefined ? null : new Set(lines);
}

/**
 * Walks a station's platform boards once to learn which lines never appear on any of them. Slow by
 * design (Portabo degrades when a station is asked for in parallel), so callers run it detached.
 */
export async function surveyDukUnplacedLines(city: CityConfig, node: string, posts: string[]): Promise<void> {
    const cacheKey = `${city.slug}:${node}`;
    const startedAt = surveysInFlight.get(cacheKey);
    if (unplacedLinesCache.get(cacheKey) !== undefined) return;
    if (startedAt !== undefined && Date.now() - startedAt < DUK_CONFIG.UNPLACED_SURVEY_ABANDON_MS) return;
    surveysInFlight.set(cacheKey, Date.now());
    try {
        const placed = new Set<string>();
        for (let i = 0; i < posts.length; i += DUK_CONFIG.UNPLACED_SURVEY_CONCURRENCY) {
            const boards = await Promise.all(posts.slice(i, i + DUK_CONFIG.UNPLACED_SURVEY_CONCURRENCY)
                .map(post => getDukStationBoard(city, node, post)));
            // A station whose boards cannot all be read is left unsurveyed rather than half-learned.
            if (boards.some(board => board === null)) return;
            for (const board of boards) for (const entry of board ?? []) placed.add(entry.line);
        }
        const virtual = await getDukStationBoard(city, node, String(DUK_CONFIG.VIRTUAL_POST));
        if (!virtual) return;
        unplacedLinesCache.set(cacheKey, [...new Set(virtual.map(entry => entry.line).filter(line => !placed.has(line)))]);
    } finally {
        surveysInFlight.delete(cacheKey);
    }
}
