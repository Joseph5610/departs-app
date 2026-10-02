import type { AppVehicleDetail, CityRequestContext } from "../../../_core/types";
import type { CityConfig } from '../../../_core/city-config';
import { getGtfsRoutes } from '../../../_feeds/gtfs/gtfs-data';
import { getTrip } from '../../../_feeds/gtfs/trip-stops';
import { getLocalClock } from '../../../_core/utils/time';
import { VehicleDetailMapper } from './VehicleDetailMapper';
import { TripConnectionsMapper } from './TripConnectionsMapper';
import { vehicleDetailQuerySchema, parseSearchParams } from '../../../_core/schemas';
import { ApiError } from '../../../_core/errors';
import { ERROR_MESSAGES } from '../../../_core/config';
import type { VehicleDetailEnricher } from './VehicleDetailEnricher';
import type { VehicleDetailUseCase } from '../../use-cases';

/**
 * The core orchestrator for the /vehicles/:id detail endpoint.
 * It builds the static timetable from the raw GTFS schedule data.
 * If an Enricher is provided, it delegates the live GPS/delay merging to that Enricher.
 */
export class VehicleDetailService implements VehicleDetailUseCase {
    constructor(
        public readonly city: CityConfig,
        private enricher?: VehicleDetailEnricher
    ) {}

    async getVehicleDetail(ctx: CityRequestContext): Promise<AppVehicleDetail> {
        const { vehicleId: rawVehicleId, tripId } = parseSearchParams(ctx.url.searchParams, vehicleDetailQuerySchema);
        const vehicleId = rawVehicleId || null;

        const [{ stations, service }, { routes }] = await Promise.all([
            getTrip(this.city, tripId),
            getGtfsRoutes(this.city),
        ]);

        const routeId = service?.routeId;
        const route = routeId ? routes[routeId] : null;

        if (stations.length === 0 && !route) {
            throw new ApiError(ERROR_MESSAGES.VEHICLE_NOT_FOUND, 404);
        }

        let detail = VehicleDetailMapper.mapVehicleDetail(tripId, vehicleId, stations, route);

        if (this.enricher) {
            detail = await this.enricher.enrich(detail, ctx);
        }

        // Runs after enrichment, which supplies the delay that decides whether a connection is at risk.
        if (stations.some(s => s.connections || s.continues_as)) {
            TripConnectionsMapper.attach(detail, stations, service, getLocalClock(this.city.timezone));
        }

        return detail;
    }
}
