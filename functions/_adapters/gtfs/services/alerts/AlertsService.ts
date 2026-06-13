import type { AppAlertsResponse } from "../../../../_core/types";
import { transit_realtime } from 'gtfs-realtime-bindings';
import type { CityConfig } from '../../../../_core/city-config';
import { getGtfsData } from '../../core/gtfs-data';
import { AlertsMapper } from './AlertsMapper';
import type { GtfsAlertEntity } from './types';

export class AlertsService {
    constructor(private city: CityConfig) {}

    async getAlerts(): Promise<AppAlertsResponse> {
        try {
            const rtUrl = this.city.adapterConfig?.realtimeUrl;
            if (!rtUrl) {
                console.warn(`[GTFS Alerts] No realtimeUrl configured for city: ${this.city.slug}`);
                return { alerts: [] };
            }

            const rtRes = await fetch(rtUrl, {
                headers: { 'User-Agent': 'departs-app/1.0' },
                cf: { cacheTtl: 60 } // Cloudflare fetch cache for 60 seconds to avoid spamming
            });
            if (!rtRes || !rtRes.ok) return { alerts: [] };

            const buffer = await rtRes.arrayBuffer();
            const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
            
            const rawAlerts = (feed.entity as unknown as GtfsAlertEntity[]).filter((e) => e.alert);

            let routes: Record<string, unknown> = {};
            try {
                const gtfsData = await getGtfsData(this.city.slug);
                routes = gtfsData.routes;
            } catch (e) {
                console.error("Failed to fetch routes for alerts", e);
            }

            const alerts = AlertsMapper.mapAlerts(rawAlerts, routes);

            return { alerts } as AppAlertsResponse;
        } catch (e) {
            console.error("Error fetching GTFS-RT alerts:", e);
            return { alerts: [] };
        }
    }
}
