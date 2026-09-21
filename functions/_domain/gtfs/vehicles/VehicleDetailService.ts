import type { AppVehicleDetail, AppVehicleCollection, CityRequestContext } from "../../../_core/types";
import type { CityConfig } from '../../../_core/city-config';
import { getGtfsRoutes, getGtfsTripRoutes } from '../../../_feeds/gtfs/gtfs-data';
import { getTripShape } from '../../../_feeds/gtfs/shapes';
import { getTripStops } from '../../../_feeds/gtfs/trip-stops';
import { getTripWindows } from '../../../_feeds/gtfs/trip-windows';
import { getLocalClock } from '../../../_core/utils/time';
import { VehicleDetailMapper } from './VehicleDetailMapper';
import { TripConnectionsMapper } from './TripConnectionsMapper';
import type { GtfsRoute } from '../../../_feeds/gtfs/gtfs-data';
import type { Station } from '../../../_feeds/gtfs/types';
import type { VehiclesService } from './VehiclesService';
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
        private enricher?: VehicleDetailEnricher,
        private vehiclesService?: VehiclesService
    ) {}

    async getVehicleDetail(ctx: CityRequestContext): Promise<AppVehicleDetail> {
        const { vehicleId: rawVehicleId, tripId } = parseSearchParams(ctx.url.searchParams, vehicleDetailQuerySchema);
        const vehicleId = rawVehicleId || null;

        const [stations, { routes }, { tripRoutes }, tripShape] = await Promise.all([
            getTripStops(this.city, tripId),
            getGtfsRoutes(this.city),
            getGtfsTripRoutes(this.city),
            getTripShape(this.city, tripId),
        ]);

        const routeId = tripRoutes[tripId];
        const route = routeId ? routes[routeId] : null;

        if (stations.length === 0 && !route) {
            throw new ApiError(ERROR_MESSAGES.VEHICLE_NOT_FOUND, 404);
        }

        let detail = VehicleDetailMapper.mapVehicleDetail(tripId, vehicleId, stations, route, tripShape);

        if (this.enricher) {
            detail = await this.enricher.enrich(detail, ctx);
        }

        // Runs after enrichment, which supplies the delay that decides whether a connection is at risk.
        if (stations.some(s => s.connections || s.continues_as)) {
            await this.attachConnections(detail, stations, routes);
        }

        return detail;
    }

    private async attachConnections(detail: AppVehicleDetail, stations: Station[], routes: Record<string, GtfsRoute>): Promise<void> {
        const [windows, live] = await Promise.all([
            getTripWindows(this.city),
            this.getLiveVehicles(),
        ]);
        TripConnectionsMapper.attach(
            detail, stations, routes, windows, live,
            getLocalClock(this.city.timezone)
        );
    }

    private async getLiveVehicles(): Promise<AppVehicleCollection | null> {
        if (!this.vehiclesService) return null;
        try {
            return await this.vehiclesService.getCachedMappedVehicles();
        } catch (e) {
            console.error('Failed to load RT vehicles for trip connections:', e);
            return null;
        }
    }
}
