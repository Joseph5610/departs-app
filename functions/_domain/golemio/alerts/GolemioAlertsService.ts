import type { AppAlertsResponse, AppAlert, Env, CityRequestContext } from "../../../_core/types";
import type * as GtfsRt from "../../../_core/gtfsRtTypes";
import type { AlertsUseCase } from "../../useCases";
import { CACHE_TTL, ERROR_MESSAGES } from "../../../_core/config";
import { ApiError } from "../../../_core/errors";
import { derive } from "../../../_core/feed/source";
import { fetchPidExclusions, getPidIncidents, getRawPidAlertFeeds } from "../../../_feeds/golemio/alerts";
import { readStoredExclusions, writeStoredExclusions } from "../../../_feeds/golemio/exclusionsStore";
import { mapRssExclusions } from "./rssAlertsMapper";
import { createPidAlertsMapper } from './pidAlertsMapper';

/** Mapped incidents per feed snapshot; null when mapping failed. */
const mappedIncidents = new WeakMap<object, { alerts: AppAlert[] | null }>();

/**
 * Prague alerts: incidents from GTFS-RT and planned exclusions from the PID RSS feed. Exclusions change
 * hourly and cost the most to map, so one isolate maps them and every other reads its stored result.
 */
export class GolemioAlertsService implements AlertsUseCase {
    private gtfsMapper = createPidAlertsMapper();

    /** Both feeds as received, for the debug feed. */
    async getRawFeed(env: Env) {
        return getRawPidAlertFeeds(env);
    }

    async getAlerts(ctx: CityRequestContext): Promise<AppAlertsResponse> {
        const [incidents, exclusions] = await Promise.all([this.incidents(ctx.env), this.exclusions()]);
        if (incidents === null && exclusions === null) {
            throw new ApiError(ERROR_MESSAGES.RSS_FEED_ERROR, 502);
        }
        return { alerts: [...incidents ?? [], ...exclusions ?? []] };
    }

    private async incidents(env: Env): Promise<AppAlert[] | null> {
        const snapshot = await getPidIncidents(env);
        if (!snapshot) return null;
        return derive(snapshot, mappedIncidents, () => ({ alerts: this.mapIncidents(snapshot.data) })).alerts;
    }

    private mapIncidents(entities: GtfsRt.IFeedEntity[]): AppAlert[] | null {
        try {
            return this.gtfsMapper.mapAlerts(entities, true);
        } catch (e) {
            console.error("Failed to map GTFS-RT alerts", e);
            return null;
        }
    }

    /** The stored exclusions while fresh; otherwise mapped anew, falling back to the stored ones if the feed fails. */
    private async exclusions(): Promise<AppAlert[] | null> {
        const stored = await readStoredExclusions(CACHE_TTL.RSS_EXCLUSIONS * 1000);
        if (stored && Date.now() - stored.builtAt < CACHE_TTL.RSS_EXCLUSIONS * 1000) return stored.alerts;

        try {
            const alerts = mapRssExclusions(await fetchPidExclusions());
            await writeStoredExclusions(alerts);
            return alerts;
        } catch (e) {
            console.error("Failed to fetch or map Exclusions RSS", e);
            return stored?.alerts ?? null;
        }
    }
}
