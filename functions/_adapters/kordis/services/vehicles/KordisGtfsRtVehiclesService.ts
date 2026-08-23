import type { AppVehicleCollection, AppVehicleFeature } from "../../../../_core/types";
import type { transit_realtime } from 'gtfs-realtime-bindings';
import { VehiclesService } from '../../../gtfs/services/vehicles/VehiclesService';
import { CacheManager, CACHE_TTL } from '../../../../_core/utils/CacheManager';
import { appClient } from '../../../../_core/ApiClient';
import { VehiclesMapper } from '../../../gtfs/services/vehicles/VehiclesMapper';
import type { ApiMapping, ApiTrip } from '../types';
import { getDpmbVehicleRanges, type DpmbVehicleRange } from '../../utils/dpmbVehicleMetadata';
import { GTFS_CONFIG } from '../../../gtfs/core/config';
import { getCurrentLocalSeconds, getZonedDateString } from '../../../gtfs/core/utils';
import type { GtfsData } from '../../../gtfs/core/gtfs-data';



export class KordisGtfsRtVehiclesService extends VehiclesService {
    
    /**
     * Fetches the mapping of static trips from the adapter config staticDataUrl.
     */
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

    /**
     * Retrieves the current time context (today's string and current minutes) for the configured timezone.
     */
    private getCurrentTimeContext() {
        const todayLocalStr = getZonedDateString(this.city.timezone);
        const currentSeconds = getCurrentLocalSeconds(this.city.timezone);
        return { todayLocalStr, currentMinutes: currentSeconds / 60 };
    }

    /**
     * Builds a map of all trips from the API mapping for O(1) lookups.
     */
    private buildTripLookup(apiMapping: ApiMapping): Map<string, ApiTrip> {
        const lookup = new Map<string, ApiTrip>();
        for (const trips of Object.values(apiMapping)) {
            for (const trip of trips) {
                lookup.set(trip.trip_id, trip);
            }
        }
        return lookup;
    }

    /**
     * Checks whether a feed entity is an invalid DPMB entry (license plate starts with 'dpmb').
     */
    private isInvalidDpmbVehicle(entity: transit_realtime.IFeedEntity): boolean {
        const lp = entity.vehicle?.vehicle?.licensePlate;
        return Boolean(lp && lp.trim().toLowerCase().startsWith('dpmb'));
    }

    /**
     * Binary search to find a matching DPMB vehicle range for a given vehicle number.
     * Expects ranges to be sorted by `min`.
     */
    private findDpmbRange(num: number, sortedRanges: DpmbVehicleRange[]): DpmbVehicleRange | null {
        let low = 0;
        let high = sortedRanges.length - 1;
        while (low <= high) {
            const mid = (low + high) >> 1;
            const range = sortedRanges[mid];
            if (num >= range.min && num <= range.max) {
                return range;
            } else if (num < range.min) {
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }
        return null;
    }

    /**
     * Selects the best-matching entity from a group of duplicate vehicle entries
     * by finding the trip active at the current time. Falls back to the first entry.
     */
    private selectBestEntity(
        entities: transit_realtime.IFeedEntity[],
        tripLookup: Map<string, ApiTrip>,
        todayStr: string,
        currentMins: number,
        gtfsData: GtfsData | null
    ): transit_realtime.IFeedEntity {
        let bestMatch: transit_realtime.IFeedEntity | null = null;
        let minTimeDiff = Infinity;

        for (const entity of entities) {
            const rawTripId = entity.vehicle?.trip?.tripId;
            if (!rawTripId) continue;
            
            let tripId: string;
            if (gtfsData?.tripRoutes && rawTripId in gtfsData.tripRoutes) {
                tripId = rawTripId;
            } else if (gtfsData?.tripAliases && rawTripId in gtfsData.tripAliases) {
                const resolved = gtfsData.tripAliases[rawTripId];
                if (!resolved) continue; // dropped trip
                tripId = resolved;
            } else {
                tripId = rawTripId;
            }
            
            const tripInfo = tripLookup.get(tripId);
            
            if (tripInfo) {
                const operatesToday = tripInfo.dates ? tripInfo.dates.includes(todayStr) : true;
                
                if (operatesToday) {
                    let diff = 0;
                    if (currentMins < tripInfo.start_mins) diff = tripInfo.start_mins - currentMins;
                    else if (currentMins > tripInfo.end_mins) diff = currentMins - tripInfo.end_mins;

                    if (diff === 0) {
                        return entity; // Found perfect active trip
                    }
                    
                    if (diff < minTimeDiff) {
                        minTimeDiff = diff;
                        bestMatch = entity;
                    }
                }
            }
        }
        
        return bestMatch ?? entities[0];
    }

    /**
     * Overrides the base vehicle fetching logic to process the KORDIS GTFS-RT feed.
     * In addition to mapping real-time positions, it performs bulk enrichment by fetching
     * the static DPMB vehicle ranges (e.g., to determine if a vehicle is air-conditioned or a specific model)
     * and merging them into the final vehicle features.
     */
    override async getCachedMappedVehicles(): Promise<AppVehicleCollection> {
        return CacheManager.getOrFetch<AppVehicleCollection>(
            `kordis_gtfsrt_vehicles_${this.city.slug}`, 
            CACHE_TTL.SHORT_DEBOUNCE_MS, 
            async () => {
                const [[feed, gtfsData], apiMapping, dpmbRanges] = await Promise.all([
                    this.getCoreData(),
                    this.getApiMapping(),
                    getDpmbVehicleRanges()
                ]);

                if (!feed || !feed.entity) {
                    return { type: 'FeatureCollection', features: [], status: 'upstream_offline' };
                }

                const sortedDpmbRanges: DpmbVehicleRange[] | null = dpmbRanges
                    ? [...dpmbRanges].sort((a, b) => a.min - b.min)
                    : null;

                const features: AppVehicleFeature[] = [];
                const nowMs = Date.now();

                // Group entities by label to handle duplicate vehicle IDs in the feed
                const groupedEntities = new Map<string, transit_realtime.IFeedEntity[]>();

                for (const entity of feed.entity) {
                    if (!entity.vehicle) continue;
                    if (this.isInvalidDpmbVehicle(entity)) continue;

                    const vp = entity.vehicle;
                    const tripId = vp.trip?.tripId;
                    if (!tripId) continue;

                    const lastUpdate = vp.timestamp ? Number(vp.timestamp) * 1000 : nowMs;
                    if (nowMs - lastUpdate > GTFS_CONFIG.VEHICLES_STALE_THRESHOLD_MS) continue;
                    
                    const label = vp.vehicle?.label || vp.vehicle?.licensePlate || vp.vehicle?.id || entity.id;
                    
                    if (!groupedEntities.has(label)) {
                        groupedEntities.set(label, []);
                    }
                    groupedEntities.get(label)!.push(entity);
                }

                let tripLookup: Map<string, ApiTrip> | null = null;
                let todayStr = '';
                let currentMins = 0;

                if (apiMapping) {
                    tripLookup = this.buildTripLookup(apiMapping);
                    const ctx = this.getCurrentTimeContext();
                    todayStr = ctx.todayLocalStr;
                    currentMins = ctx.currentMinutes;
                }

                for (const [label, entities] of groupedEntities.entries()) {
                    const selectedEntity = (entities.length > 1 && tripLookup)
                        ? this.selectBestEntity(entities, tripLookup, todayStr, currentMins, gtfsData)
                        : entities[0];

                    const vp = selectedEntity.vehicle;
                    if (!vp) continue;

                    const rawTripId = vp.trip?.tripId;
                    if (!rawTripId) continue;

                    let tripId: string;
                    if (gtfsData.tripRoutes && rawTripId in gtfsData.tripRoutes) {
                        tripId = rawTripId; // Active in current GTFS, trust it
                    } else if (gtfsData.tripAliases && rawTripId in gtfsData.tripAliases) {
                        const resolved = gtfsData.tripAliases[rawTripId];
                        if (!resolved) continue; // null = dropped old trip
                        tripId = resolved;
                    } else {
                        tripId = rawTripId;
                    }

                    const routeInfo = gtfsData.tripRoutes[tripId];
                    if (!routeInfo) continue;

                    const routeId = routeInfo.split('|')[0];
                    const route = gtfsData.routes[routeId];
                    if (!route) continue;

                    const lastUpdate = vp.timestamp ? Number(vp.timestamp) * 1000 : nowMs;
                    // Rewrite the vehicle ID to the label so it matches the group correctly.
                    // This prevents multiple markers from rendering if deduplication fails.
                    if (vp.vehicle) {
                        vp.vehicle.id = label;
                    }

                    const tripInfo = this.findTripInfo(tripId, rawTripId, tripLookup);
                    const isBeforeTrack = this.isVehicleBeforeTrack(vp, tripInfo, currentMins);

                    const liveMatch = VehiclesMapper.mapVehicle(vp, tripId, route, lastUpdate, null, isBeforeTrack);
                    
                    if (sortedDpmbRanges && liveMatch.properties.vehicle_id) {
                        const num = parseInt(liveMatch.properties.vehicle_id, 10);
                        if (!isNaN(num)) {
                            const rangeMatch = this.findDpmbRange(num, sortedDpmbRanges);
                            if (rangeMatch) {
                                liveMatch.properties.vehicle_descriptor = {
                                    ...liveMatch.properties.vehicle_descriptor,
                                    vehicle_type: rangeMatch.vehicle_type,
                                    is_air_conditioned: rangeMatch.is_air_conditioned !== undefined ? rangeMatch.is_air_conditioned : liveMatch.properties.vehicle_descriptor?.is_air_conditioned
                                };
                            }
                        }
                    }

                    features.push(liveMatch);
                }

                return { type: 'FeatureCollection', features, status: 'ok' };
            },
            (col) => !col || col.status === 'upstream_offline' || !col.features || col.features.length === 0
        );
    }

    /**
     * Checks if vehicle is at origin before departure.
     */
    private isVehicleBeforeTrack(
        vp: transit_realtime.IVehiclePosition,
        tripInfo: ApiTrip | undefined,
        currentMins: number
    ): boolean {
        if (!tripInfo) return false;

        const start = tripInfo.start_mins % 1440;
        const current = currentMins % 1440;
        let diffMins = start - current;
        if (diffMins < -720) diffMins += 1440;

        return diffMins > 1 && diffMins <= 60;
    }

    override async getSingleLiveVehicle(vehicleId: string, gtfsTripId?: string) {
        if (!vehicleId && !gtfsTripId) return {};

        const collection = await this.getCachedMappedVehicles();
        if (!collection || !collection.features || collection.features.length === 0) return {};

        const liveMatch = collection.features.find(f => {
            if (gtfsTripId && f.properties.gtfs_trip_id === gtfsTripId) return true;
            if (vehicleId && (f.properties.vehicle_id === vehicleId || f.properties.vehicle_descriptor?.vehicle_registration_number === vehicleId)) return true;
            return false;
        });

        if (!liveMatch) return {};

        return { 
            liveMatch, 
            lastStopId: undefined
        };
    }

    /**
     * Resolves the correct trip information from the api mapping using the final or raw trip ID.
     */
    private findTripInfo(tripId: string, rawTripId: string | undefined, tripLookup: Map<string, ApiTrip> | null): ApiTrip | undefined {
        if (!tripLookup) return undefined;
        return tripLookup.get(tripId) || (rawTripId ? tripLookup.get(rawTripId) : undefined);
    }
}
