import type { AppAlertsResponse } from "../../../../_core/types";

import type { CityConfig } from '../../../../_core/city-config';
import { getGtfsData } from '../../core/gtfs-data';
import { BaseGtfsAlertsMapper } from './BaseGtfsAlertsMapper';
import { getGtfsRtFeed } from '../../core/gtfs-rt-feed';

export class AlertsService {
    constructor(private city: CityConfig, private mapper: BaseGtfsAlertsMapper) {}

    async getAlerts(): Promise<AppAlertsResponse> {
        try {
            const rtUrl = this.city.adapterConfig?.realtimeUrl;
            if (!rtUrl) {
                console.warn(`[GTFS Alerts] No realtimeUrl configured for city: ${this.city.slug}`);
                return { alerts: [] };
            }

            const feed = await getGtfsRtFeed(this.city.slug, rtUrl);
            if (!feed) return { alerts: [] };
            
            const rawAlerts = feed.entity.filter(e => e.alert != null);

            let routes: Record<string, unknown> = {};
            try {
                const gtfsData = await getGtfsData(this.city.slug);
                routes = gtfsData.routes;
            } catch (e) {
                console.error("Failed to fetch routes for alerts", e);
            }

            const alerts = this.mapper.mapAlerts(rawAlerts, routes);

            return { alerts } as AppAlertsResponse;
        } catch (e) {
            console.error("Error fetching GTFS-RT alerts:", e);
            return { alerts: [] };
        }
    }
}
