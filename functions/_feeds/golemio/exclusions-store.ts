import { readEdgeCache, writeEdgeCache } from '../../_core/ApiClient';
import type { AppAlert } from '../../_core/types';
import { GOLEMIO_CONFIG } from './config';

/** The mapped planned exclusions and when they were built. `_domain` maps them; this only stores them. */
export interface StoredExclusions {
    builtAt: number;
    alerts: AppAlert[];
}

const KEY = 'pid_exclusions';
const BUILT_AT_HEADER = 'X-Built-At';

/** This isolate's newest copy, so a warm isolate skips both the Cache API and the parse. */
let inMemory: StoredExclusions | null = null;

/** The newest stored exclusions: this isolate's own while fresh, else the edge copy when newer. */
export async function readStoredExclusions(freshMs: number): Promise<StoredExclusions | null> {
    if (inMemory && Date.now() - inMemory.builtAt < freshMs) return inMemory;

    const res = await readEdgeCache(KEY);
    const builtAt = Number(res?.headers.get(BUILT_AT_HEADER));
    if (res && Number.isFinite(builtAt) && builtAt > (inMemory?.builtAt ?? 0)) {
        inMemory = { builtAt, alerts: await res.json() as AppAlert[] };
    }
    return inMemory;
}

/** Stores freshly mapped exclusions in this isolate and at the edge. */
export async function writeStoredExclusions(alerts: AppAlert[]): Promise<void> {
    inMemory = { builtAt: Date.now(), alerts };
    const headers = { 'Content-Type': 'application/json', [BUILT_AT_HEADER]: String(inMemory.builtAt) };
    await writeEdgeCache(KEY, new Response(JSON.stringify(alerts), { headers }), GOLEMIO_CONFIG.EXCLUSIONS_STORE_S);
}
