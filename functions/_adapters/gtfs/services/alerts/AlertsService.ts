import type { AppAlertsResponse } from "../../../../_core/types";
import type { CityConfig } from '../../../../_core/city-config';
import { getGtfsData } from '../../core/gtfs-data';
import { BaseGtfsAlertsMapper } from './BaseGtfsAlertsMapper';
import { getGtfsRtFeed } from '../../core/gtfs-rt-feed';
import { ApiError } from '../../../../_core/errors';
import { ERROR_MESSAGES } from '../../../../_core/api-utils';

export class AlertsService {
    constructor(public readonly city: CityConfig, private mapper: BaseGtfsAlertsMapper) {}

    async getAlerts(): Promise<AppAlertsResponse> {
        try {
            const feed = await getGtfsRtFeed(this.city).catch((e) => {
                console.warn(`[GTFS Alerts] getGtfsRtFeed failed: ${e.message}`);
                return null;
            });
            if (!feed) return { alerts: [] };
            
            const rawAlerts = feed.entity.filter(e => e.alert != null);

            let gtfsData = null;
            try {
                gtfsData = await getGtfsData(this.city.slug);
            } catch (e) {
                console.error("Failed to fetch routes for alerts", e);
            }

            const alerts = this.mapper.mapAlerts(rawAlerts, gtfsData);

            return { alerts } as AppAlertsResponse;
        } catch (e) {
            console.error("Error fetching GTFS-RT alerts:", e);
            throw new ApiError(ERROR_MESSAGES.RSS_FEED_ERROR, 502);
        }
    }
}
