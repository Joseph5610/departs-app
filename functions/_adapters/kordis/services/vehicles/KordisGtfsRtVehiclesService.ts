import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppVehicleCollection, AppVehicleFeature } from "../../../../_core/types";
import { VehiclesService } from '../../../gtfs/services/vehicles/VehiclesService';
import { CacheManager, CACHE_TTL } from '../../../../_core/utils/CacheManager';
import { appClient } from '../../../../_core/ApiClient';
import { VehiclesMapper } from '../../../gtfs/services/vehicles/VehiclesMapper';
import { getDpmbVehicleMetadata } from '../../utils/dpmbVehicleMetadata';

export interface ApiTripData {
    trip_id: string;
    start_mins: number;
    end_mins: number;
    dates: string[];
}

export type ApiMapping = Record<string, ApiTripData[]>;

export class KordisGtfsRtVehiclesService extends VehiclesService {
    private async getApiMapping(): Promise<ApiMapping | null> {
        const staticUrl = this.city.adapterConfig?.staticDataUrl;
        if (!staticUrl) return null;
        
        const apiUrl = `${staticUrl}/${this.city.slug}/api.json`;

        return CacheManager.getOrFetch<ApiMapping | null>(
            `api_mapping_${this.city.slug}`, 
            CACHE_TTL.TWO_HOURS_MS, 
            async () => {
                try {
                    const resApi = await appClient.fetch(apiUrl, { cf: { cacheTtl: 7200 } });
                    return await resApi.json() as ApiMapping;
                } catch (e) {
                    console.error("Failed to fetch api.json for KordisGtfsRtVehiclesService", e);
                    return null;
                }
            }
        );
    }

    private getCurrentTimeContext() {
        // Use Prague time since api.json mins are in Prague local time
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Europe/Prague',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false
        });

        const parts = formatter.formatToParts(now);
        const y = parts.find(p => p.type === 'year')?.value || '';
        const m = parts.find(p => p.type === 'month')?.value || '';
        const d = parts.find(p => p.type === 'day')?.value || '';
        const hh = parts.find(p => p.type === 'hour')?.value || '0';
        const mm = parts.find(p => p.type === 'minute')?.value || '0';
        const ss = parts.find(p => p.type === 'second')?.value || '0';

        const todayLocalStr = `${y}${m}${d}`;
        // Handle Intl midnight edge case (sometimes 24 instead of 0)
        const hour = Number(hh) % 24;
        const currentMinutes = hour * 60 + Number(mm) + Number(ss) / 60;
        
        return { todayLocalStr, currentMinutes };
    }

    private buildTripLookup(apiMapping: ApiMapping): Map<string, ApiTripData> {
        const lookup = new Map<string, ApiTripData>();
        for (const trips of Object.values(apiMapping)) {
            for (const trip of trips) {
                lookup.set(trip.trip_id, trip);
            }
        }
        return lookup;
    }

    override async getCachedMappedVehicles(): Promise<AppVehicleCollection> {
        return CacheManager.getOrFetch<AppVehicleCollection>(
            `kordis_gtfsrt_vehicles_${this.city.slug}`, 
            CACHE_TTL.TEN_SECONDS_MS, 
            async () => {
                const [feed, gtfsData, apiMapping] = await Promise.all([
                    this.getCoreData().then(res => res[0]),
                    this.getCoreData().then(res => res[1]),
                    this.getApiMapping()
                ]);

                if (!feed || !feed.entity) {
                    return { type: 'FeatureCollection', features: [], status: 'upstream_offline' };
                }

                const features: AppVehicleFeature[] = [];
                const THRESHOLD_MS = 10 * 60 * 1000;
                const nowMs = Date.now();

                // Group entities by label
                const groupedEntities = new Map<string, any[]>();

                for (const entity of feed.entity) {
                    if (!entity.vehicle) continue;
                    const vp = entity.vehicle;
                    const tripId = vp.trip?.tripId;
                    if (!tripId) continue;
                    
                    const lastUpdate = vp.timestamp ? Number(vp.timestamp) * 1000 : nowMs;
                    if (nowMs - lastUpdate > THRESHOLD_MS) continue;
                    
                    const label = vp.vehicle?.label || vp.vehicle?.id || entity.id;
                    
                    if (!groupedEntities.has(label)) {
                        groupedEntities.set(label, []);
                    }
                    groupedEntities.get(label)!.push(entity);
                }

                let tripLookup: Map<string, ApiTripData> | null = null;
                let todayStr = '';
                let currentMins = 0;

                if (apiMapping) {
                    tripLookup = this.buildTripLookup(apiMapping);
                    const ctx = this.getCurrentTimeContext();
                    todayStr = ctx.todayLocalStr;
                    currentMins = ctx.currentMinutes;
                }

                for (const [label, entities] of groupedEntities.entries()) {
                    let selectedEntity = entities[0]; // default to first

                    if (entities.length > 1 && tripLookup) {
                        let bestMatch = null;
                        let minTimeDiff = Infinity;

                        for (const entity of entities) {
                            const tripId = entity.vehicle.trip.tripId;
                            const tripInfo = tripLookup.get(tripId);
                            
                            if (tripInfo) {
                                // Prefer a trip that operates today and spans the current time
                                const operatesToday = tripInfo.dates.includes(todayStr);
                                
                                // Buffer to include slightly delayed/early trips
                                const BUFFER_MINS = 30; 
                                
                                if (operatesToday && currentMins >= (tripInfo.start_mins - BUFFER_MINS) && currentMins <= (tripInfo.end_mins + BUFFER_MINS)) {
                                    bestMatch = entity;
                                    break; // Found perfect active trip
                                }

                                // Fallback: find the closest trip in time
                                if (operatesToday) {
                                    let diff = Infinity;
                                    if (currentMins < tripInfo.start_mins) diff = tripInfo.start_mins - currentMins;
                                    else if (currentMins > tripInfo.end_mins) diff = currentMins - tripInfo.end_mins;
                                    
                                    if (diff < minTimeDiff) {
                                        minTimeDiff = diff;
                                        bestMatch = entity;
                                    }
                                }
                            }
                        }
                        
                        if (bestMatch) {
                            selectedEntity = bestMatch;
                        }
                    }

                    const vp = selectedEntity.vehicle;
                    const tripId = vp.trip.tripId;
                    const routeInfo = gtfsData.tripRoutes[tripId];
                    if (!routeInfo) continue;

                    const routeId = routeInfo.split('|')[0];
                    const route = gtfsData.routes[routeId];
                    if (!route) continue;

                    const lastUpdate = vp.timestamp ? Number(vp.timestamp) * 1000 : nowMs;
                    // Rewrite the vehicle ID to the label so it matches the group correctly
                    // This prevents multiple markers from rendering if the deduplication fails
                    if (vp.vehicle) {
                        vp.vehicle.id = label;
                    }

                    const liveMatch = VehiclesMapper.mapVehicle(vp, tripId, route, lastUpdate, 0);

                    if (liveMatch.properties.vehicle_id) {
                        const meta = await getDpmbVehicleMetadata(liveMatch.properties.vehicle_id);
                        if (meta) {
                            liveMatch.properties.vehicle_descriptor = {
                                ...liveMatch.properties.vehicle_descriptor,
                                vehicle_type: meta.vehicle_type,
                                is_air_conditioned: meta.is_air_conditioned !== undefined ? meta.is_air_conditioned : liveMatch.properties.vehicle_descriptor?.is_air_conditioned
                            };
                        }
                    }

                    features.push(liveMatch);
                }

                return { type: 'FeatureCollection', features, status: 'ok' };
            }
        );
    }

    override async getSingleLiveVehicle(vehicleId: string, gtfsTripId?: string) {
        // If gtfsTripId is provided, we can reliably fetch it without guessing
        if (gtfsTripId) {
            return super.getSingleLiveVehicle(vehicleId, gtfsTripId);
        }

        const [feed, gtfsData, apiMapping] = await Promise.all([
            this.getCoreData().then(res => res[0]),
            this.getCoreData().then(res => res[1]),
            this.getApiMapping()
        ]);

        if (!feed || !feed.entity || feed.entity.length === 0) return {};

        const copies = feed.entity.filter(e => 
            e.vehicle?.vehicle?.id === vehicleId || 
            e.vehicle?.vehicle?.label === vehicleId ||
            e.id === vehicleId
        );

        if (copies.length === 0) return {};

        let rawMatch = copies[0];

        if (copies.length > 1 && apiMapping) {
            const tripLookup = this.buildTripLookup(apiMapping);
            const { todayLocalStr, currentMinutes } = this.getCurrentTimeContext();
            
            let bestMatch = null;
            let minTimeDiff = Infinity;

            for (const entity of copies) {
                const tripId = entity.vehicle?.trip?.tripId;
                if (!tripId) continue;
                
                const tripInfo = tripLookup.get(tripId);
                if (tripInfo) {
                    const operatesToday = tripInfo.dates.includes(todayLocalStr);
                    const BUFFER_MINS = 30; 
                    
                    if (operatesToday && currentMinutes >= (tripInfo.start_mins - BUFFER_MINS) && currentMinutes <= (tripInfo.end_mins + BUFFER_MINS)) {
                        bestMatch = entity;
                        break;
                    }
                    if (operatesToday) {
                        let diff = Infinity;
                        if (currentMinutes < tripInfo.start_mins) diff = tripInfo.start_mins - currentMinutes;
                        else if (currentMinutes > tripInfo.end_mins) diff = currentMinutes - tripInfo.end_mins;
                        
                        if (diff < minTimeDiff) {
                            minTimeDiff = diff;
                            bestMatch = entity;
                        }
                    }
                }
            }
            if (bestMatch) {
                rawMatch = bestMatch;
            }
        }

        const vp = rawMatch.vehicle;
        if (!vp) return {};

        const tripId = vp.trip?.tripId || '';
        if (!tripId) return {};

        const routeInfo = gtfsData.tripRoutes[tripId];
        if (!routeInfo) return {};

        const routeId = routeInfo.split('|')[0];
        const route = gtfsData.routes[routeId];
        if (!route) return {};

        const lastUpdate = vp.timestamp ? Number(vp.timestamp) * 1000 : Date.now();
        if (vp.vehicle) vp.vehicle.id = vehicleId;

        const liveMatch = VehiclesMapper.mapVehicle(vp, tripId, route, lastUpdate, 0);

        if (liveMatch.properties.vehicle_id) {
            const meta = await getDpmbVehicleMetadata(liveMatch.properties.vehicle_id);
            if (meta) {
                liveMatch.properties.vehicle_descriptor = {
                    ...liveMatch.properties.vehicle_descriptor,
                    vehicle_type: meta.vehicle_type,
                    is_air_conditioned: meta.is_air_conditioned !== undefined ? meta.is_air_conditioned : liveMatch.properties.vehicle_descriptor?.is_air_conditioned
                };
            }
        }

        return { 
            liveMatch, 
            lastStopId: vp.stopId?.toString() 
        };
    }
}
