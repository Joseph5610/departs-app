import { AppAlertsResponse } from "../../../../_core/types";
import { CACHE_TTL, ERROR_MESSAGES } from "../../../../_core/api-utils";
import { ApiError } from "../../../../_core/errors";
import { GolemioClient } from "../../core/GolemioClient";
import { AlertsMapper } from "./AlertsMapper";

/**
 * Service for fetching and processing transit alerts (incidents and exclusions).
 * Uses the external PID RSS feeds.
 */
export class AlertsService {
    constructor(private client: GolemioClient) {}

    private async fetchFeed(url: string): Promise<string> {
        const isExclusion = url.includes('vyluky');
        const cacheTtl = isExclusion ? CACHE_TTL.RSS_EXCLUSIONS : CACHE_TTL.RSS_INCIDENTS;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; departs-app/0.1; +https://departs.app)',
                    'Accept': 'application/rss+xml, application/xml, text/xml'
                },
                cf: {
                    cacheTtl,
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
     * Fetches and combines both PID RSS incidents and exclusions feeds.
     * 
     * @param {Env} env - The environment configuration
     * @returns {Promise<AppAlertsResponse>} Combined alerts response
     */
    async getAlerts(): Promise<AppAlertsResponse> {
        try {
            const [incidentsRes, exclusionsRes] = await Promise.allSettled([
                this.fetchFeed("https://pid.cz/feed/rss-mimoradnosti/"),
                this.fetchFeed("https://pid.cz/feed/rss-vyluky/")
            ]);

            const incidents = incidentsRes.status === 'fulfilled' ? AlertsMapper.mapRSS(incidentsRes.value, 'incidents') : [];
            const exclusions = exclusionsRes.status === 'fulfilled' ? AlertsMapper.mapRSS(exclusionsRes.value, 'exclusions') : [];

            if (incidentsRes.status === 'rejected' && exclusionsRes.status === 'rejected') {
                throw new ApiError("Both RSS feeds failed to fetch", 502);
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
