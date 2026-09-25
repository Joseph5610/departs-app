import type * as GtfsRt from '../../_core/gtfsRtTypes';
import { z } from 'zod';
import type { Env } from '../../_core/types';
import { CACHE_TTL, ERROR_MESSAGES } from '../../_core/config';
import { ApiError } from '../../_core/errors';
import { appClient } from '../../_core/ApiClient';
import { createSource, type Snapshot } from '../../_core/feed/source';
import { decodeAlertFeed } from '../../_core/gtfsRtAlerts';
import { GOLEMIO_CONFIG } from './config';
import { golemioClient } from './GolemioClient';
import { pidRssItemSchema } from './schemas/alerts';
import { readRssItems } from './rss-exclusions';

export type PidRssItem = z.infer<typeof pidRssItemSchema>;

/** Both PID alert feeds; null for a part that could not be read. */
export interface PidAlertFeeds {
    /** GTFS-RT alert entities (incidents). */
    incidents: GtfsRt.IFeedEntity[] | null;
    /** RSS items (planned exclusions). */
    exclusions: PidRssItem[] | null;
}

/**
 * The RSS document's items, validated; a malformed item is dropped rather than failing the rest.
 *
 * Reads items with `readRssItems` (a parser purpose-built for this feed's flat item shape) rather
 * than the generic `XMLParser` used by `parseRssXml`: on the real ~450 KB, ~250-item feed, the
 * generic parse alone cost 20-25ms, over the CPU limit on its own regardless of isolate warmth.
 */
function parseRssItems(xmlString: string): PidRssItem[] {
    const rawItems = readRssItems(xmlString);

    const safeArraySchema = z.array(pidRssItemSchema.nullable().catch(err => {
        console.warn("Skipping invalid RSS item:", err);
        return null;
    }));
    return safeArraySchema.parse(rawItems).filter((i): i is NonNullable<typeof i> => i !== null);
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

async function readAlertFeeds(env: Env): Promise<PidAlertFeeds> {
    const [incidentsRes, exclusionsRes] = await Promise.allSettled([
        fetchIncidents(env),
        fetchExclusionsXml().then(parseRssItems),
    ]);

    if (incidentsRes.status === 'rejected') {
        console.error("Failed to fetch PB alerts", incidentsRes.reason);
    }
    if (exclusionsRes.status === 'rejected') {
        console.error("Failed to fetch Exclusions RSS", exclusionsRes.reason);
    }

    return {
        incidents: incidentsRes.status === 'fulfilled' ? incidentsRes.value : null,
        exclusions: exclusionsRes.status === 'fulfilled' ? exclusionsRes.value : null,
    };
}

const alertFeedsSource = createSource<PidAlertFeeds, Env>({
    key: 'golemio_alerts',
    ttlMs: CACHE_TTL.RSS_INCIDENTS * 1000,
    // One feed failing still answers, but that half answer is not what the next five minutes are
    // served from: the last complete one is kept and the feeds are retried shortly.
    isEmpty: (feeds) => feeds.incidents === null || feeds.exclusions === null,
    read: readAlertFeeds,
});

/** Incidents (GTFS-RT) and exclusions (PID RSS), read together once per `CACHE_TTL.RSS_INCIDENTS`. */
export function getPidAlertFeeds(env: Env): Promise<Snapshot<PidAlertFeeds> | null> {
    return alertFeedsSource(env);
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
