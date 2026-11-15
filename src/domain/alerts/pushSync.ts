import type { WatchedLine } from '@shared/alerts';

/** What the server last got for a city: `key` fingerprints it, `at` is when. */
export interface DisruptionPushSync {
    key: string;
    at: number;
}

/** A city with pinned lines; `lines` is null until its routes are known. */
export interface CityWatch {
    city: string;
    lines: WatchedLine[] | null;
}

export type DisruptionSyncStep =
    | { action: 'add'; city: string; lines: WatchedLine[]; path: string; key: string }
    | { action: 'remove'; city: string };

/** Fingerprints what the server holds for a subscription and city: lines, title or page change it, so does a new subscription. */
export const disruptionSyncKey = (endpoint: string, lines: readonly WatchedLine[], title: string, path: string): string =>
    `${endpoint}|${title}|${path}|${JSON.stringify(lines)}`;

/**
 * What it takes to bring the server in line with the pins: an add for a city whose copy differs or is due for renewal,
 * a removal for a recorded city with nothing pinned any more. A city whose routes aren't known yet is left alone.
 */
export const disruptionSyncSteps = (
    watches: readonly CityWatch[],
    synced: Readonly<Record<string, DisruptionPushSync>>,
    { endpoint, title, pathOf, now, renewAfterMs }: { endpoint: string; title: string; pathOf: (city: string) => string; now: number; renewAfterMs: number },
): DisruptionSyncStep[] => {
    const steps: DisruptionSyncStep[] = [];
    const watched = new Map(watches.map(watch => [watch.city, watch.lines]));
    for (const [city, lines] of watched) {
        if (lines === null) continue;
        if (lines.length === 0) {
            if (synced[city]) steps.push({ action: 'remove', city });
            continue;
        }
        const path = pathOf(city);
        const key = disruptionSyncKey(endpoint, lines, title, path);
        const last = synced[city];
        if (last?.key !== key || now - last.at >= renewAfterMs) steps.push({ action: 'add', city, lines, path, key });
    }
    for (const city of Object.keys(synced)) {
        if (!watched.has(city)) steps.push({ action: 'remove', city });
    }
    return steps;
};
