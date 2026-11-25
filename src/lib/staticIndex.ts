import { apiFetch } from '@/lib/apiClient';
import { EXTERNAL_URLS, INDOOR_MAP } from '@/config/constants';

/**
 * A small index file on the static data CDN (`indoor/index.json`, `platforms/index.json`), asked for under a
 * URL that changes every `INDEX_REFRESH_MS` so a copy the CDN keeps for hours is never read past a republish.
 * An index of another format version (before or after a departs-data release) reads as `empty`.
 */
export async function fetchStaticIndex<T extends { version: number }>(path: string, version: T['version'], empty: T, signal: AbortSignal): Promise<T> {
    const index = await apiFetch<T>(`${EXTERNAL_URLS.STATIC_DATA}/${path}?h=${Math.floor(Date.now() / INDOOR_MAP.INDEX_REFRESH_MS)}`, { signal });
    return index.version === version ? index : empty;
}
