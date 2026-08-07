import { AppAlertsResponse, AppAlert, Env } from "../../../../_core/types";
import { CACHE_TTL, ERROR_MESSAGES } from "../../../../_core/api-utils";
import { ApiError } from "../../../../_core/errors";
import { GolemioClient } from "../../core/GolemioClient";
import { RssAlertsMapper } from "./RssAlertsMapper";
import gtfsRt from 'gtfs-realtime-bindings';
const { transit_realtime } = gtfsRt;
import { GtfsAlertsMapper } from './GtfsAlertsMapper';
import { GtfsRoute } from '../../../gtfs/core/gtfs-data';
import { GOLEMIO_CONFIG } from "../../core/config";
import { appClient } from '../../../../_core/ApiClient';
import { z } from 'zod';
import { golemioRouteSchema } from './schemas';

/**
 * Service for fetching and processing transit alerts (incidents and exclusions).
 * Uses GTFS-RT PB for incidents and PID RSS feeds for exclusions.
 */
export class AlertsService {
    private gtfsMapper = new GtfsAlertsMapper();

    constructor(private client: GolemioClient) {}

    private async fetchExclusionsFeed(): Promise<string> {
        // We use the unified appClient which brings an 8.5s timeout by default.
        // RSS Exclusions might be a bit slow, but if it takes > 8.5s we want it to timeout anyway.
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
     * Fetches raw alerts data for debug feeds.
     */
    async getRawFeed(env: Env) {
        const [pbRes, exclusionsRes] = await Promise.allSettled([
            this.client.fetch("/v2/vehiclepositions/gtfsrt/alerts.pb", env, { cacheTtl: CACHE_TTL.RSS_INCIDENTS }),
            this.fetchExclusionsFeed()
        ]);

        let incidents = null;
        if (pbRes.status === 'fulfilled' && pbRes.value.ok) {
            const buffer = await pbRes.value.arrayBuffer();
            incidents = transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
        }

        let exclusions = null;
        if (exclusionsRes.status === 'fulfilled') {
            const { XMLParser } = await import("fast-xml-parser");
            const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
            exclusions = parser.parse(exclusionsRes.value);
        }

        return {
            incidents: incidents ? incidents.toJSON() : null,
            exclusions
        };
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
                    const rawAlerts = feed.entity.filter(e => e.alert != null);

                    const routesJson = await routesRes.value.json();
                    const parsedRoutes = z.array(golemioRouteSchema).safeParse(routesJson);
                    const routesData = parsedRoutes.success ? parsedRoutes.data : [];
                    
                    const routesMap: Record<string, GtfsRoute> = {};
                    const routesByName: Record<string, GtfsRoute> = {};
                    for (const r of routesData) {
                        const route = {
                            name: r.route_id,
                            short_name: r.route_short_name,
                            type: r.route_type,
                            route_color: r.route_color ? '#' + r.route_color : undefined
                        };
                        routesMap[r.route_id] = route;
                        if (r.route_short_name) {
                            routesByName[r.route_short_name.toUpperCase()] = route;
                        }
                    }
                    
                    const gtfsData = { routes: routesMap, routesByName, tripRoutes: {} };
                    incidents = this.gtfsMapper.mapAlerts(rawAlerts, gtfsData, true);
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
