import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppVehicleDetail } from "../../../../_core/types";

import type { CityConfig } from '../../../../_core/city-config';
import { getGtfsData } from '../../core/gtfs-data';
import { appClient } from '../../../../_core/ApiClient';
import { VehicleDetailMapper } from './VehicleDetailMapper';
import type { Station } from './types';
import { vehicleDetailQuerySchema, parseSearchParams } from '../../../../_core/schemas';
import { ApiError } from '../../../../_core/errors';
import { ERROR_MESSAGES } from '../../../../_core/api-utils';
import type { VehicleDetailEnricher } from './VehicleDetailEnricher';

/**
 * The core orchestrator for the /vehicles/:id detail endpoint.
 * It builds the static timetable from the raw GTFS schedule data.
 * If an Enricher is provided, it delegates the live GPS/delay merging to that Enricher.
 */
export class VehicleDetailService {
    constructor(private city: CityConfig, private enricher?: VehicleDetailEnricher) {}

    async getVehicleDetail(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleDetail> {
        const url = new URL(ctx.request.url);
        const { vehicleId: rawVehicleId, tripId } = parseSearchParams(url.searchParams, vehicleDetailQuerySchema);
        const vehicleId = rawVehicleId || null;

        if (!tripId) {
            return VehicleDetailMapper.buildErrorResponse(vehicleId, '', 'Unknown destination');
        }

        const stations = await this.getTripStops(tripId);
        const { routes, tripRoutes } = await getGtfsData(this.city.slug);
        
        const routeInfo = tripRoutes[tripId];
        const routeId = routeInfo ? routeInfo.split('|')[0] : undefined;
        const route = routeId ? routes[routeId] : null;

        if (stations.length === 0 && !route) {
            throw new ApiError(ERROR_MESSAGES.VEHICLE_NOT_FOUND, 404);
        }

        let detail = VehicleDetailMapper.mapVehicleDetail(tripId, vehicleId, stations, route);
        
        if (this.enricher) {
            detail = await this.enricher.enrich(detail, ctx);
        }
        
        return detail;
    }



    private async getTripStops(tripId: string): Promise<Station[]> {
        const chunkId = encodeURIComponent(tripId.substring(0, 3).toUpperCase());
        const staticDataUrl = this.city.adapterConfig?.staticDataUrl;
        if (!staticDataUrl) throw new Error('Missing staticDataUrl in city config');

        const tripUrl = `${staticDataUrl}/${this.city.slug}/trips/${chunkId}.json`;
        try {
            const tripRes = await appClient.fetch(tripUrl);
            const chunkData = await tripRes.json() as Record<string, unknown[]>;
            const tripData = chunkData[tripId];
            if (!tripData) return [];

            return tripData.map((st: unknown, idx: number) => {
                const s = st as Record<string, unknown>;
                return {
                    id: s.stop_id as string,
                    name: (s.name as string) || 'Unknown',
                    sequence: idx + 1,
                    arrival_time: s.arrival_time as string,
                    departure_time: s.departure_time as string,
                    coordinates: [Number(s.lon) || 0, Number(s.lat) || 0] as [number, number],
                    is_wheelchair_accessible: null,
                    zone_id: null
                };
            });
        } catch (e) {
            console.error('Failed to get trip stops:', e);
            return [];
        }
    }
}
