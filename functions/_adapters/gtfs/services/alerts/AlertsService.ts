import type { AppAlertsResponse } from "../../../../_core/types";
import { transit_realtime } from 'gtfs-realtime-bindings';
import type { CityConfig } from '../../../../_core/city-config';
import { getGtfsData } from '../../core/gtfs-data';
import { appClient } from '../../../../_core/ApiClient';
import { AlertsMapper } from './AlertsMapper';


export class AlertsService {
    constructor(private city: CityConfig) {}

    async getAlerts(): Promise<AppAlertsResponse> {
        try {
            const rtUrl = this.city.adapterConfig?.realtimeUrl;
            if (!rtUrl) {
                console.warn(`[GTFS Alerts] No realtimeUrl configured for city: ${this.city.slug}`);
                return { alerts: [] };
            }

            const rtRes = await appClient.fetch(rtUrl, { cf: { cacheTtl: 60 } });
            if (!rtRes || !rtRes.ok) return { alerts: [] };

            const buffer = await rtRes.arrayBuffer();
            const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
            
            const rawAlerts = feed.entity.filter(e => e.alert != null);

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
