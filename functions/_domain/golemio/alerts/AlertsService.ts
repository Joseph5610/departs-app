import type { AppAlertsResponse, AppAlert, Env, CityRequestContext } from "../../../_core/types";
import type { AlertsUseCase } from "../../use-cases";
import { ERROR_MESSAGES } from "../../../_core/config";
import { ApiError } from "../../../_core/errors";
import { deriveAsync, type Derivation } from "../../../_core/feed/source";
import { getPidAlertFeeds, getRawPidAlertFeeds, type PidAlertFeeds } from "../../../_feeds/golemio/alerts";
import { RssAlertsMapper } from "./RssAlertsMapper";
import { createPidAlertsMapper } from './pid-alerts-mapper';

/** Mapped alerts per feeds snapshot: parsing and mapping a few hundred alerts runs once per snapshot. */
const mapped = new WeakMap<object, Derivation<AppAlertsResponse>>();

/** Prague alerts: incidents from GTFS-RT and planned exclusions from the PID RSS feed. */
export class AlertsService implements AlertsUseCase {
    private gtfsMapper = createPidAlertsMapper();

    /** Both feeds as received, for the debug feed. */
    async getRawFeed(env: Env) {
        return getRawPidAlertFeeds(env);
    }

    async getAlerts(ctx: CityRequestContext): Promise<AppAlertsResponse> {
        const snapshot = await getPidAlertFeeds(ctx.env);
        if (!snapshot) throw new ApiError(ERROR_MESSAGES.RSS_FEED_ERROR, 502);
        return deriveAsync(snapshot, mapped, async () => this.map(snapshot.data));
    }

    /** Maps whatever of the two feeds was read; throws only when neither could be. */
    private map(feeds: PidAlertFeeds): AppAlertsResponse {
        let incidents: AppAlert[] = [];
        let incidentsFailed = true;
        if (feeds.incidents && feeds.routes) {
            try {
                incidents = this.gtfsMapper.mapAlerts(feeds.incidents, feeds.routes, true);
                incidentsFailed = false;
            } catch (e) {
                console.error("Failed to map GTFS-RT alerts", e);
            }
        }

        let exclusions: AppAlert[] = [];
        let exclusionsFailed = feeds.exclusions === null;
        if (feeds.exclusions) {
            try {
                exclusions = RssAlertsMapper.mapRSS(feeds.exclusions);
            } catch (e) {
                console.error("Failed to map Exclusions RSS", e);
                exclusionsFailed = true;
            }
        }

        if (incidentsFailed && exclusionsFailed) {
            throw new ApiError(ERROR_MESSAGES.RSS_FEED_ERROR, 502);
        }
        return { alerts: [...incidents, ...exclusions] };
    }
}
