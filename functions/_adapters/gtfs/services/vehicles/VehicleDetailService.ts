import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppVehicleDetail } from "../../../../_core/types";

import type { CityConfig } from '../../../../_core/city-config';
import { getGtfsData } from '../../core/gtfs-data';
import { gtfsFetch } from '../../core/utils';
import { VehicleDetailMapper } from './VehicleDetailMapper';
import type { Station } from './types';
import { vehicleDetailQuerySchema, parseSearchParams } from '../../../../_core/schemas';

export class VehicleDetailService {
    constructor(private city: CityConfig) {}

    async getVehicleDetail(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleDetail> {
        const url = new URL(ctx.request.url);
        const { vehicleId: rawVehicleId, tripId } = parseSearchParams(url.searchParams, vehicleDetailQuerySchema);
        const vehicleId = rawVehicleId || null;

        if (!tripId) {
            return VehicleDetailMapper.buildErrorResponse(vehicleId, '', 'Unknown destination');
        }

        try {

            const stations = await this.getTripStops(tripId);
            const { routes, tripRoutes } = await getGtfsData(this.city.slug);
            
            const routeInfo = tripRoutes[tripId];
            const routeId = routeInfo ? routeInfo.split('|')[0] : undefined;
            const route = routeId ? routes[routeId] : null;

            return VehicleDetailMapper.mapVehicleDetail(tripId, vehicleId, stations, route);
        } catch (e) {
            console.error("Error fetching vehicle detail:", e);
            return VehicleDetailMapper.buildErrorResponse(vehicleId, tripId, 'Error');
        }
    }



    private async getTripStops(tripId: string): Promise<Station[]> {
        const chunkId = encodeURIComponent(tripId.substring(0, 3).toUpperCase());
        const staticDataUrl = this.city.adapterConfig?.staticDataUrl;
        if (!staticDataUrl) throw new Error('Missing staticDataUrl in city config');

        const tripUrl = `${staticDataUrl}/${this.city.slug}/trips/${chunkId}.json`;
        try {
            const tripRes = await gtfsFetch(tripUrl);
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
