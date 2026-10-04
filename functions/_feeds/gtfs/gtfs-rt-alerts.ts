import type * as GtfsRt from '../../_core/gtfsRtTypes';
import { createSource, type Snapshot } from '../../_core/feed/source';
import type { CityConfig } from '../../_core/city-config';
import { CACHE_TTL } from '../../_core/config';
import { decodeAlertEntity } from '../../_core/gtfsRtDecode';
import { getGtfsRtAlertEntities } from './gtfs-rt-feed';

type AlertEntities = GtfsRt.IFeedEntity[];

const sources = new Map<string, () => Promise<Snapshot<AlertEntities> | null>>();

function sourceFor(city: CityConfig) {
    let source = sources.get(city.slug);
    if (source) return source;

    source = createSource<AlertEntities>({
        key: `gtfs_rt_alerts_${city.slug}`,
        // Alerts change over hours, not seconds; mapping them is what this window saves.
        ttlMs: CACHE_TTL.RSS_INCIDENTS * 1000,
        read: async () => {
            try {
                // Decoded here, on the alerts window, so the vehicles path never pays for alert text.
                return (await getGtfsRtAlertEntities(city)).map(decodeAlertEntity);
            } catch (e) {
                console.warn(`[GTFS Alerts] getGtfsRtAlertEntities failed: ${e instanceof Error ? e.message : e}`);
                return null;
            }
        },
    });
    sources.set(city.slug, source);
    return source;
}

/**
 * The alert entities of a city's GTFS-RT feed, re-read at most once per `CACHE_TTL.RSS_INCIDENTS`.
 * A failed read keeps the last good snapshot; null only when there has never been one.
 */
export function getGtfsRtAlerts(city: CityConfig): Promise<Snapshot<AlertEntities> | null> {
    return sourceFor(city)();
}
