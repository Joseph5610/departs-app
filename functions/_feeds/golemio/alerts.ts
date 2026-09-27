import type * as GtfsRt from '../../_core/gtfsRtTypes';
import type { Env } from '../../_core/types';
import { CACHE_TTL, ERROR_MESSAGES } from '../../_core/config';
import { ApiError } from '../../_core/errors';
import { appClient } from '../../_core/ApiClient';
import { createSource, type Snapshot } from '../../_core/feed/source';
import { decodeAlertFeed } from '../../_core/gtfsRtAlerts';
import { GOLEMIO_CONFIG } from './config';
import { golemioClient } from './GolemioClient';
import { readRssItems, type PidRssItem } from './rss-exclusions';

/** The planned exclusions RSS as items; throws when it cannot be read. */
export async function fetchPidExclusions(): Promise<PidRssItem[]> {
    return readRssItems(await fetchExclusionsXml());
}

async function fetchExclusionsXml(): Promise<string> {
    const response = await appClient.fetch(GOLEMIO_CONFIG.FEEDS.exclusions, {
        headers: {
            'Accept': 'application/rss+xml, application/xml, text/xml'
        },
        cf: {
            cacheTtl: CACHE_TTL.RSS_EXCLUSIONS,
            cacheEverything: true
        }
    });

    if (!response.ok) {
        throw new ApiError(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), response.status);
    }
    return await response.text();
}

/**
 * The feed's alert entities, decoded with `decodeAlertFeed` - a parser purpose-built for the GTFS-RT
 * `Alert` message, not the generated decoder - so the app's own `IFeedEntity` shape comes straight out
 * of the decode instead of a second pass over a protobufjs message tree.
 */
async function fetchIncidents(env: Env): Promise<GtfsRt.IFeedEntity[]> {
    const response = await golemioClient.fetch("/v2/vehiclepositions/gtfsrt/alerts.pb", env, { cacheTtl: CACHE_TTL.RSS_INCIDENTS });
    if (!response.ok) {
        throw new Error(`Failed to fetch PB alerts: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    return decodeAlertFeed(new Uint8Array(buffer));
}

const incidentsSource = createSource<GtfsRt.IFeedEntity[], Env>({
    key: 'golemio_alerts',
    ttlMs: CACHE_TTL.RSS_INCIDENTS * 1000,
    read: (env) => fetchIncidents(env).catch((error: unknown) => {
        console.error("Failed to fetch PB alerts", error);
        return null;
    }),
});

/** Incidents (GTFS-RT), read once per `CACHE_TTL.RSS_INCIDENTS`; a failed read keeps the last good one. */
export function getPidIncidents(env: Env): Promise<Snapshot<GtfsRt.IFeedEntity[]> | null> {
    return incidentsSource(env);
}

/** Both feeds as received, uncached, for the debug feed. */
export async function getRawPidAlertFeeds(env: Env): Promise<{ incidents: unknown; exclusions: unknown }> {
    const [incidentsRes, exclusionsRes] = await Promise.allSettled([
        fetchIncidents(env),
        fetchExclusionsXml()
    ]);

    return {
        incidents: incidentsRes.status === 'fulfilled' ? incidentsRes.value : null,
        exclusions: exclusionsRes.status === 'fulfilled' ? readRssItems(exclusionsRes.value) : null,
    };
}
