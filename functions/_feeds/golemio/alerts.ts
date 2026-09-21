import { transit_realtime } from 'gtfs-realtime-bindings';
import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import type { Env } from '../../_core/types';
import { CACHE_TTL, ERROR_MESSAGES, UPSTREAM_TTL_S } from '../../_core/config';
import { ApiError } from '../../_core/errors';
import { appClient } from '../../_core/ApiClient';
import { CacheManager, MEMORY_CACHE_TTL } from '../../_core/feed/CacheManager';
import { createSource, type Snapshot } from '../../_core/feed/source';
import type { GtfsRoute, GtfsRoutesData } from '../gtfs/gtfs-data';
import { GOLEMIO_CONFIG } from './config';
import { golemioClient } from './GolemioClient';
import { golemioRouteSchema, pidRssItemSchema } from './schemas/alerts';

export type PidRssItem = z.infer<typeof pidRssItemSchema>;

/** Both PID alert feeds and the routes their incidents refer to; null for a part that could not be read. */
export interface PidAlertFeeds {
    /** GTFS-RT alert entities (incidents). */
    incidents: transit_realtime.IFeedEntity[] | null;
    routes: GtfsRoutesData | null;
    /** RSS items (planned exclusions). */
    exclusions: PidRssItem[] | null;
}

const rssParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

/** The only part of the RSS document this codebase navigates. */
interface RssDocument {
    rss?: { channel?: { item?: unknown } };
}

/** Shared PID RSS parse — the parser options must match wherever the feed is read. */
function parseRssXml(xmlString: string): RssDocument {
    return rssParser.parse(xmlString) as RssDocument;
}

/** The RSS document's items, validated; a malformed item is dropped rather than failing the rest. */
function parseRssItems(xmlString: string): PidRssItem[] {
    const item = parseRssXml(xmlString)?.rss?.channel?.item;
    const rawItems: unknown[] = item ? (Array.isArray(item) ? item : [item]) : [];

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

async function fetchIncidents(env: Env): Promise<transit_realtime.FeedMessage> {
    const response = await golemioClient.fetch("/v2/vehiclepositions/gtfsrt/alerts.pb", env, { cacheTtl: CACHE_TTL.RSS_INCIDENTS });
    if (!response.ok) {
        throw new Error(`Failed to fetch PB alerts: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    return transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
}

/** PID routes by id and by short name, for the lines incidents name. Read once a day. */
function getRoutes(env: Env): Promise<GtfsRoutesData> {
    return CacheManager.getOrFetch(
        'prague_routes_map',
        MEMORY_CACHE_TTL.ONE_DAY_MS,
        async () => {
            const routesRes = await golemioClient.fetch("/v2/gtfs/routes", env, { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA });
            if (!routesRes.ok) throw new Error("Failed to fetch routes");

            const routesJson = await routesRes.json();
            const parsedRoutes = z.array(golemioRouteSchema).safeParse(routesJson);
            const routesData = parsedRoutes.success ? parsedRoutes.data : [];

            const routes: Record<string, GtfsRoute> = {};
            const routesByName: Record<string, GtfsRoute> = {};
            for (const r of routesData) {
                const route = {
                    name: r.route_id,
                    short_name: r.route_short_name,
                    type: r.route_type,
                    route_color: r.route_color ? '#' + r.route_color : undefined
                };
                routes[r.route_id] = route;
                if (r.route_short_name) {
                    routesByName[r.route_short_name.toUpperCase()] = route;
                }
            }
            return { routes, routesByName };
        }
    );
}

async function readAlertFeeds(env: Env): Promise<PidAlertFeeds> {
    const [incidentsRes, routesRes, exclusionsRes] = await Promise.allSettled([
        fetchIncidents(env),
        getRoutes(env),
        fetchExclusionsXml().then(parseRssItems),
    ]);

    if (incidentsRes.status === 'rejected' || routesRes.status === 'rejected') {
        console.error("Failed to fetch PB alerts or Routes",
            incidentsRes.status === 'rejected' ? incidentsRes.reason : null,
            routesRes.status === 'rejected' ? routesRes.reason : null
        );
    }
    if (exclusionsRes.status === 'rejected') {
        console.error("Failed to fetch Exclusions RSS", exclusionsRes.reason);
    }

    return {
        incidents: incidentsRes.status === 'fulfilled' ? incidentsRes.value.entity.filter(e => e.alert != null) : null,
        routes: routesRes.status === 'fulfilled' ? routesRes.value : null,
        exclusions: exclusionsRes.status === 'fulfilled' ? exclusionsRes.value : null,
    };
}

const alertFeedsSource = createSource<PidAlertFeeds, Env>({
    key: 'golemio_alerts',
    ttlMs: CACHE_TTL.RSS_INCIDENTS * 1000,
    // One feed failing still answers, but that half answer is not what the next five minutes are
    // served from: the last complete one is kept and the feeds are retried shortly.
    isEmpty: (feeds) => feeds.incidents === null || feeds.routes === null || feeds.exclusions === null,
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
        incidents: incidentsRes.status === 'fulfilled' ? incidentsRes.value.toJSON() : null,
        exclusions: exclusionsRes.status === 'fulfilled' ? parseRssXml(exclusionsRes.value) : null,
    };
}
