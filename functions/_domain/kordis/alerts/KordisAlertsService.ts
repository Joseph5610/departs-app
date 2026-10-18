import type { AppAlertsResponse, CityRequestContext } from '../../../_core/types';
import { derive, type Snapshot } from '../../../_core/feed/source';
import { getKordisDiversions, type KordisDiversion } from '../../../_feeds/kordis/diversions';
import { KORDIS_CONFIG } from '../../../_feeds/kordis/config';
import type { AlertsUseCase } from '../../useCases';
import { enrichWithDiversions, indexDiversions, type IndexedDiversion } from './diversions';

/** Indexed diversions per diversions snapshot, so dates are parsed once per read rather than per request. */
const indexed = new WeakMap<object, { diversions: IndexedDiversion[] }>();

/** The diversions if they arrive within `DIVERSIONS_WAIT_MS`; a slower read keeps going for the next request. */
async function diversionsWithinBudget(ctx: CityRequestContext): Promise<Snapshot<KordisDiversion[]> | null> {
    const read = getKordisDiversions().catch(() => null);
    ctx.waitUntil(read);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), KORDIS_CONFIG.DIVERSIONS_WAIT_MS); });
    try {
        return await Promise.race([read, timeout]);
    } finally {
        clearTimeout(timer);
    }
}

/** KORDIS alerts: the GTFS-RT alerts, enriched with the open-data diversions when those can be read. */
export class KordisAlertsService implements AlertsUseCase {
    constructor(private readonly rt: AlertsUseCase, private readonly timezone: string) {}

    async getAlerts(ctx: CityRequestContext): Promise<AppAlertsResponse> {
        const [response, snapshot] = await Promise.all([this.rt.getAlerts(ctx), diversionsWithinBudget(ctx)]);
        if (!snapshot) return response;
        try {
            const { diversions } = derive(snapshot, indexed, () => ({
                diversions: indexDiversions(snapshot.data, this.timezone, KORDIS_CONFIG.DIVERSIONS_LINK),
            }));
            const alerts = enrichWithDiversions(response.alerts, diversions, Date.now());
            return alerts === response.alerts ? response : { alerts };
        } catch (e) {
            // Enrichment only: unexpected diversion data must never cost the RT alerts.
            console.warn(`[KORDIS diversions] enrichment failed: ${e instanceof Error ? e.message : e}`);
            return response;
        }
    }
}
