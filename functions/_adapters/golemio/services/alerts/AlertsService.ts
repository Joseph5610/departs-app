import { AppAlertsResponse, Env } from "../../../../_core/types";
import { CACHE_TTL, ERROR_MESSAGES } from "../../../../_core/api-utils";
import { ApiError } from "../../../../_core/errors";
import { GolemioClient } from "../../core/GolemioClient";
import { AlertsMapper as RssAlertsMapper } from "./AlertsMapper";
import { AlertsMapper as GtfsAlertsMapper } from "../../../gtfs/services/alerts/AlertsMapper";
import { transit_realtime } from 'gtfs-realtime-bindings';
import { GOLEMIO_CONFIG } from "../../core/config";
import type { GtfsRoute } from "../../../gtfs/core/gtfs-data";
import type { GtfsAlertEntity } from "../../../gtfs/services/alerts/types";

/**
 * Service for fetching and processing transit alerts (incidents and exclusions).
 * Uses GTFS-RT PB for incidents and PID RSS feeds for exclusions.
 */
export class AlertsService {
    constructor(private client: GolemioClient) {}

    private async fetchExclusionsFeed(): Promise<string> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(GOLEMIO_CONFIG.FEEDS.exclusions, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; departs-app/0.1; +https://departs.app)',
                    'Accept': 'application/rss+xml, application/xml, text/xml'
                },
                cf: {
                    cacheTtl: CACHE_TTL.RSS_EXCLUSIONS,
                    cacheEverything: true
                },
                signal: controller.signal
            });

            if (!response.ok) throw new ApiError(`Upstream error: ${response.status}`, 502);
            return await response.text();
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Main entry point to get all alerts.
     * Fetches GTFS-RT Incidents and RSS Exclusions.
     * 
     * @param {Env} env - The environment configuration
     * @returns {Promise<AppAlertsResponse>} Combined alerts response
     */
    async getAlerts(env: Env): Promise<AppAlertsResponse> {
        try {
            const [pbRes, routesRes, exclusionsRes] = await Promise.allSettled([
                this.client.fetch("/v2/vehiclepositions/gtfsrt/alerts.pb", env, { cacheTtl: CACHE_TTL.RSS_INCIDENTS }),
                this.client.fetch("/v2/gtfs/routes", env, { cacheTtl: 86400 }), // Cache routes for a day
                this.fetchExclusionsFeed()
            ]);

            // Handle GTFS-RT Incidents
            let incidents: AppAlert[] = [];
            if (pbRes.status === 'fulfilled' && pbRes.value.ok && routesRes.status === 'fulfilled' && routesRes.value.ok) {
                try {
                    const buffer = await pbRes.value.arrayBuffer();
                    const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
                    const rawAlerts = (feed.entity as unknown as GtfsAlertEntity[]).filter((e) => e.alert);

                    const routesData = await routesRes.value.json() as Array<{ route_id: string; route_short_name: string; route_type: number; route_color?: string }>;
                    const routesMap: Record<string, GtfsRoute> = {};
                    
                    for (const r of routesData) {
                        routesMap[r.route_id] = {
                            name: r.route_id,
                            short_name: r.route_short_name,
                            type: r.route_type,
                            route_color: r.route_color ? '#' + r.route_color : undefined
                        };
                    }

                    incidents = GtfsAlertsMapper.mapAlerts(rawAlerts, routesMap, true);
                } catch (e) {
                    console.error("Failed to parse GTFS-RT alerts or routes", e);
                }
            } else {
                console.error("Failed to fetch PB alerts or Routes", 
                    pbRes.status === 'rejected' ? pbRes.reason : 'PB response not OK',
                    routesRes.status === 'rejected' ? routesRes.reason : 'Routes response not OK'
                );
            }

            // Handle RSS Exclusions
            let exclusions: AppAlert[] = [];
            if (exclusionsRes.status === 'fulfilled') {
                exclusions = RssAlertsMapper.mapRSS(exclusionsRes.value);
            } else {
                console.error("Failed to fetch Exclusions RSS", exclusionsRes.reason);
            }

            if (incidents.length === 0 && exclusions.length === 0 && exclusionsRes.status === 'rejected') {
                throw new ApiError("Failed to fetch alerts from all sources", 502);
            }

            return {
                alerts: [...incidents, ...exclusions]
            };
        } catch (error) {
            console.error('PID Alerts error:', error);
            throw new ApiError(ERROR_MESSAGES.RSS_FEED_ERROR, 500, { cause: error });
        }
    }
}
