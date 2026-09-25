import type { AppAlertsResponse } from "../../../_core/types";
import type { CityConfig } from '../../../_core/city-config';
import { deriveAsync, type Derivation } from '../../../_core/feed/source';
import { getGtfsRtAlerts } from '../../../_feeds/gtfs/gtfs-rt-alerts';
import type { AlertsMapper } from './alerts-mapper';
import { ApiError } from '../../../_core/errors';
import { ERROR_MESSAGES } from '../../../_core/config';
import type { AlertsUseCase } from '../../use-cases';

/** Mapped alerts per alerts snapshot, so mapping runs once per snapshot rather than per request. */
const mapped = new WeakMap<object, Derivation<AppAlertsResponse>>();

export class AlertsService implements AlertsUseCase {
    constructor(public readonly city: CityConfig, private mapper: AlertsMapper) {}

    async getAlerts(): Promise<AppAlertsResponse> {
        const snapshot = await getGtfsRtAlerts(this.city);
        if (!snapshot) throw new ApiError(ERROR_MESSAGES.RSS_FEED_ERROR, 502);
        return deriveAsync(snapshot, mapped, () => Promise.resolve({ alerts: this.mapper.mapAlerts(snapshot.data) }));
    }
}
