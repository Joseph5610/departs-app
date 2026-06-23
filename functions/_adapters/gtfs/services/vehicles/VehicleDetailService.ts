import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppVehicleDetail, AppVehicleCollection, AppVehicleProperties } from "../../../../_core/types";
import { transit_realtime } from "gtfs-realtime-bindings";
import type { CityConfig } from '../../../../_core/city-config';
import { getGtfsData } from '../../core/gtfs-data';
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
            const currentVehicleData = await this.getRealtimeVehicleData(tripId, vehicleId);
            const stations = await this.getTripStops(tripId);
            const { routes, tripRoutes } = await getGtfsData(this.city.slug);
            
            const routeId = tripRoutes[tripId];
            const route = routeId ? routes[routeId] : null;

            return VehicleDetailMapper.mapVehicleDetail(tripId, vehicleId, currentVehicleData, stations, route);
        } catch (e) {
            console.error("Error fetching vehicle detail:", e);
            return VehicleDetailMapper.buildErrorResponse(vehicleId, tripId, 'Error');
        }
    }

    private async getRealtimeVehicleData(tripId: string, vehicleId: string | null): Promise<transit_realtime.IVehiclePosition | null> {
        const cache = caches.default;
        const jsonCacheKey = new Request(`https://departs.app/cache/${this.city.slug}/vehicles_v1`, { method: 'GET' });
        const cachedVehicles = await cache.match(jsonCacheKey);
        
        if (cachedVehicles) {
            const vehiclesGeoJson: AppVehicleCollection = await cachedVehicles.json();
            const match = vehiclesGeoJson.features.find(
                (f) => vehicleId ? f.properties.vehicle_id === vehicleId : f.properties.gtfs_trip_id === tripId
            );
            if (match) {
                const p = match.properties as AppVehicleProperties & { current_stop_id?: string | null };
                return {
                    timestamp: p.origin_timestamp ? BigInt(Math.floor(new Date(p.origin_timestamp).getTime() / 1000)) : null,
                    currentStatus: p.state_position === 'at_stop' ? 1 : 2,
                    currentStopSequence: p.last_stop_sequence || null,
                    stopId: p.current_stop_id || null,
                    position: match.geometry ? {
                        latitude: match.geometry.coordinates[1],
                        longitude: match.geometry.coordinates[0],
                        bearing: p.bearing || undefined,
                    } : null,
                    vehicle: {
                        label: p.vehicle_descriptor?.vehicle_registration_number,
                        id: p.vehicle_id
                    }
                } as transit_realtime.IVehiclePosition;
            }
        } 
        
        // Cache miss — fetch raw RT feed as fallback
        const realtimeUrl = this.city.adapterConfig?.realtimeUrl;
        if (!realtimeUrl) throw new Error('Missing realtimeUrl in city config');
        
        const rtResponse = await fetch(realtimeUrl, {
            headers: { 'User-Agent': 'departs-app/1.0' }
        });
        
        if (rtResponse.ok) {
            const buffer = await rtResponse.arrayBuffer();
            const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
            for (const entity of feed.entity) {
                const vid = entity.vehicle?.vehicle?.id || entity.id;
                const tid = entity.vehicle?.trip?.tripId;
                if ((vehicleId && vid === vehicleId) || (!vehicleId && tid === tripId)) {
                    return entity.vehicle || null;
                }
            }
        }
        
        return null;
    }

    public async getVehicleDelay(
        tripId: string, 
        currentVehicleData: transit_realtime.IVehiclePosition | null,
        scheduledTimestampMs?: number
    ): Promise<{ delay: number, lastStopSequence: number | null, hasDeparted: boolean }> {
        if (!currentVehicleData) return { delay: 0, lastStopSequence: null, hasDeparted: false };
        try {
            const stations = await this.getTripStops(tripId);
            const feedTotalSecs = VehicleDetailMapper.getFeedTotalSecs(currentVehicleData);
            const nowSecs = VehicleDetailMapper.getNowSecs();
            const { computedDelay, lastStopSequence } = VehicleDetailMapper.calculateDelayAndSequence(
                currentVehicleData, 
                stations, 
                feedTotalSecs, 
                nowSecs
            );

            let hasDeparted = false;
            if (scheduledTimestampMs && lastStopSequence !== null) {
                const schedTime = new Date(scheduledTimestampMs);
                const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Prague', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false });
                const parts = formatter.formatToParts(schedTime);
                const fHour = Number(parts.find(p => p.type === 'hour')?.value) || 0;
                const fMin = Number(parts.find(p => p.type === 'minute')?.value) || 0;
                const fSec = Number(parts.find(p => p.type === 'second')?.value) || 0;
                const boardSchedSecs = (fHour % 24) * 3600 + fMin * 60 + fSec;

                let targetIdx = -1;
                for (let i = 0; i < stations.length; i++) {
                    const st = stations[i];
                    const stTimeStr = st.departure_time || st.arrival_time;
                    if (stTimeStr) {
                        const stParts = String(stTimeStr).split(':').map(Number);
                        const stSecs = (stParts[0] % 24) * 3600 + (stParts[1] || 0) * 60 + (stParts[2] || 0);
                        if (Math.abs(stSecs - boardSchedSecs) <= 60) {
                            targetIdx = i;
                            break;
                        }
                    }
                }

                if (targetIdx !== -1) {
                    const boardSequence = targetIdx + 1;
                    if (lastStopSequence > boardSequence) {
                        hasDeparted = true;
                    } else if (lastStopSequence === boardSequence && currentVehicleData.currentStatus !== 1) {
                        hasDeparted = true;
                    }
                }
            }

            return { delay: computedDelay, lastStopSequence, hasDeparted };
        } catch {
            return { delay: 0, lastStopSequence: null, hasDeparted: false };
        }
    }

    private async getTripStops(tripId: string): Promise<Station[]> {
        const chunkId = encodeURIComponent(tripId.substring(0, 3).toUpperCase());
        const staticDataUrl = this.city.adapterConfig?.staticDataUrl;
        if (!staticDataUrl) throw new Error('Missing staticDataUrl in city config');

        const tripUrl = `${staticDataUrl}/${this.city.slug}/trips/${chunkId}.json`;
        const tripRes = await fetch(tripUrl);
        if (!tripRes.ok) return [];
        
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
    }
}
