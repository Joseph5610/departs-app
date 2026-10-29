import { appClient } from '../../_core/ApiClient';
import { createSource, type Snapshot } from '../../_core/feed/source';
import { KORDIS_CONFIG } from './config';

/** One iRIS diversion as Brno open data publishes it; dates are `dd.MM.yyyy HH:mm` Prague wall-clock. */
export interface KordisDiversion {
    diversionid: number;
    /** The closure's number, shared by the records KORDIS posts for one closure (a short notice, then a detailed one). */
    number_: string | null;
    title: string;
    publictext: string | null;
    /** Comma-separated line names, the same strings the RT feed sends as `routeId`. */
    affectedlines: string | null;
    /** iRIS kind: V výluka, D dopravní opatření, P provozní omezení, Z přesun zastávky. */
    type_: string | null;
    validfrom: string | null;
    validto: string | null;
    /** WGS84 point of the closure, as iRIS places it. */
    latitude: number | null;
    longitude: number | null;
}

interface ArcGisQueryResponse {
    features?: Array<{ attributes: KordisDiversion }>;
}

async function fetchDiversions(): Promise<KordisDiversion[] | null> {
    try {
        const response = await appClient.fetch(KORDIS_CONFIG.DIVERSIONS_URL, {
            cacheTtl: KORDIS_CONFIG.DIVERSIONS_CACHE_S,
            timeoutMs: KORDIS_CONFIG.DIVERSIONS_TIMEOUT_MS,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        // ArcGIS answers a failed query with 200 and an `error` body instead of `features`.
        const body = await response.json() as ArcGisQueryResponse;
        if (!Array.isArray(body.features)) throw new Error('no features in response');
        return body.features.map(f => f.attributes);
    } catch (e) {
        console.warn(`[KORDIS diversions] read failed: ${e instanceof Error ? e.message : e}`);
        return null;
    }
}

const source = createSource<KordisDiversion[]>({
    key: 'kordis_diversions',
    ttlMs: KORDIS_CONFIG.DIVERSIONS_CACHE_S * 1000,
    read: fetchDiversions,
    isEmpty: (data) => data.length === 0,
});

/** The diversions, re-read at most once per `DIVERSIONS_CACHE_S`; a failed read keeps the last good one, null when there never was one. */
export function getKordisDiversions(): Promise<Snapshot<KordisDiversion[]> | null> {
    return source();
}
