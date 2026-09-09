import type { AppVehicleCollection, AppVehicleFeature } from "../../../../_core/types";
import type { transit_realtime } from 'gtfs-realtime-bindings';
import { VehiclesService } from '../../../gtfs/services/vehicles/VehiclesService';
import { CacheManager, CACHE_TTL } from '../../../../_core/utils/CacheManager';
import { appClient } from '../../../../_core/ApiClient';
import { VehiclesMapper } from '../../../gtfs/services/vehicles/VehiclesMapper';
import type { ApiMapping, ApiTrip } from '../types';
import { GTFS_CONFIG } from '../../../gtfs/core/config';
import { getCurrentLocalSeconds, getZonedDateString } from '../../../gtfs/core/utils';
import type { GtfsTripRoutesData } from '../../../gtfs/core/gtfs-data';

export class KordisGtfsRtVehiclesService extends VehiclesService {
    
    /**
     * Fetches the mapping of static trips from the adapter config staticDataUrl.
     */
    private async getApiMapping(): Promise<{ mapping: ApiMapping, lookup: Record<string, ApiTrip> } | null> {
        const staticUrl = this.city.adapterConfig?.staticDataUrl;
        if (!staticUrl) return null;
        
        const apiUrl = `${staticUrl}/${this.city.slug}/api.json`;

        return CacheManager.getOrFetch<{ mapping: ApiMapping, lookup: Record<string, ApiTrip> } | null>(
            `api_mapping_with_lookup_${this.city.slug}`, 
            CACHE_TTL.TWO_HOURS_MS,
            async () => {
                try {
                    const resApi = await appClient.fetch(apiUrl, { cf: { cacheTtl: 7200 } });
                    if (!resApi.ok) {
                        console.error(`Failed to fetch api.json for ${this.city.slug}: ${resApi.status}`);
                        return null;
                    }
                    const mapping = await resApi.json() as ApiMapping;
                    const lookup: Record<string, ApiTrip> = {};
                    for (const trips of Object.values(mapping)) {
                        for (let i = 0; i < trips.length; i++) {
                            const trip = trips[i];
                            lookup[trip.trip_id] = trip;
                        }
                    }
                    return { mapping, lookup };
                } catch (e) {
                    console.error("Failed to fetch api.json for KordisGtfsRtVehiclesService", e);
                    return null;
                }
            },
            (data) => !data || Object.keys(data.lookup).length === 0
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
     * Resolves a raw feed trip id to the id used by the current GTFS export.
     *
     * KORDIS keeps emitting trip ids from a previous export for a while after a schedule change,
     * so ids absent from `tripRoutes` are looked up in the alias table. Returns null when the alias
     * table explicitly marks the trip as dropped.
     */
    private resolveTripId(rawTripId: string, tripRoutes: GtfsTripRoutesData): string | null {
        if (tripRoutes.tripRoutes && rawTripId in tripRoutes.tripRoutes) {
            return rawTripId; // Active in current GTFS, trust it
        }
        if (tripRoutes.tripAliases && rawTripId in tripRoutes.tripAliases) {
            return tripRoutes.tripAliases[rawTripId] ?? null; // null = dropped old trip
        }
        return rawTripId;
    }

    /**
     * Checks whether a feed entity is an invalid DPMB entry (license plate starts with 'dpmb' or 'DPMB').
     */
    private isInvalidDpmbVehicle(entity: transit_realtime.IFeedEntity): boolean {
        const lp = entity.vehicle?.vehicle?.licensePlate;
        if (!lp) return false;
        return lp.trim().toLowerCase().startsWith('dpmb');
    }

    /**
     * Selects the best-matching entity from a group of duplicate vehicle entries
     * by finding the trip active at the current time. Falls back to the first entry.
     */
    private selectBestEntity(
        entities: transit_realtime.IFeedEntity[],
        tripLookup: Record<string, ApiTrip>,
        todayStr: string,
        currentMins: number,
        tripRoutesObj: { tripRoutes: Record<string, string>, tripAliases: Record<string, string | null> }
    ): transit_realtime.IFeedEntity {
        let bestMatch: transit_realtime.IFeedEntity | null = null;
        let minTimeDiff = Infinity;

        for (const entity of entities) {
            const rawTripId = entity.vehicle?.trip?.tripId;
            if (!rawTripId) continue;
            
            const tripId = this.resolveTripId(rawTripId, tripRoutesObj);
            if (!tripId) continue; // dropped trip

            const tripInfo = tripLookup[tripId];
            
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
     * Overrides the base vehicle fetching logic to process the KORDIS GTFS-RT feed, which needs
     * de-duplication by vehicle label and alias resolution for trip ids carried over from a
     * previous GTFS export.
     */
    override async getCachedMappedVehicles(): Promise<AppVehicleCollection> {
        return CacheManager.getOrFetch<AppVehicleCollection>(
            `kordis_gtfsrt_vehicles_${this.city.slug}`, 
            CACHE_TTL.SHORT_DEBOUNCE_MS, 
            async () => {
                const tInitStart = Date.now();

                const [[feed, gtfsData, tripRoutesObj], apiData] = await Promise.all([
                    this.getCoreData(),
                    this.getApiMapping()
                ]);

                console.log(`[PERF] ${this.city.slug} initialization (core + api_mapping): ${Date.now() - tInitStart}ms`);

                if (!feed || !feed.entity) {
                    return { type: 'FeatureCollection', features: [], status: 'upstream_offline' };
                }



                const tMapStart = Date.now();
                const features: AppVehicleFeature[] = [];
                const nowMs = Date.now();

                // Group entities by label to handle duplicate vehicle IDs in the feed
                const groupedEntities: Record<string, transit_realtime.IFeedEntity[]> = {};

                for (let i = 0; i < feed.entity.length; i++) {
                    const entity = feed.entity[i];
                    if (!entity.vehicle) continue;
                    
                    if (this.isInvalidDpmbVehicle(entity)) continue;

                    const vp = entity.vehicle;
                    const tripId = vp.trip?.tripId;
                    if (!tripId) continue;

                    const lastUpdate = vp.timestamp ? Number(vp.timestamp) * 1000 : nowMs;
                    if (nowMs - lastUpdate > GTFS_CONFIG.VEHICLES_STALE_THRESHOLD_MS) continue;
                    
                    const label = vp.vehicle?.label || vp.vehicle?.licensePlate || vp.vehicle?.id || entity.id;
                    
                    if (!groupedEntities[label]) {
                        groupedEntities[label] = [];
                    }
                    groupedEntities[label].push(entity);
                }

                let tripLookup: Record<string, ApiTrip> | null = null;
                let todayStr = '';
                let currentMins = 0;

                if (apiData) {
                    tripLookup = apiData.lookup;
                    const ctx = this.getCurrentTimeContext();
                    todayStr = ctx.todayLocalStr;
                    currentMins = ctx.currentMinutes;
                }

                const keys = Object.keys(groupedEntities);
                for (let i = 0; i < keys.length; i++) {
                    const label = keys[i];
                    const entities = groupedEntities[label];

                    const selectedEntity = (entities.length > 1 && tripLookup)
                        ? this.selectBestEntity(entities, tripLookup, todayStr, currentMins, tripRoutesObj)
                        : entities[0];

                    const vp = selectedEntity.vehicle;
                    if (!vp) continue;

                    const rawTripId = vp.trip?.tripId;
                    if (!rawTripId) continue;

                    const tripId = this.resolveTripId(rawTripId, tripRoutesObj);
                    if (!tripId) continue;

                    const routeInfo = tripRoutesObj.tripRoutes[tripId];
                    if (!routeInfo) continue;

                    const route = gtfsData.routes[routeInfo];
                    if (!route) continue;

                    const lastUpdate = vp.timestamp ? Number(vp.timestamp) * 1000 : nowMs;
                    const originTimestamp = new Date(lastUpdate).toISOString();
                    
                    // Rewrite the vehicle ID to the label so it matches the group correctly.
                    // This prevents multiple markers from rendering if deduplication fails.
                    if (vp.vehicle) {
                        vp.vehicle.id = label;
                    }

                    const tripInfo = this.findTripInfo(tripId, rawTripId, tripLookup);
                    const isBeforeTrack = this.isVehicleBeforeTrack(vp, tripInfo, currentMins);

                    const liveMatch = VehiclesMapper.mapVehicle(vp, tripId, route, originTimestamp, null, isBeforeTrack);

                    features.push(liveMatch);
                }

                const tMapEnd = Date.now();
                console.log(`[PERF] ${this.city.slug} total array mapping loop: ${tMapEnd - tMapStart}ms (entities: ${feed.entity.length})`);

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

    protected override isRelevantEntity(entity: transit_realtime.IFeedEntity): boolean {
        return !this.isInvalidDpmbVehicle(entity);
    }

    protected override matchesTripId(
        entity: transit_realtime.IFeedEntity,
        gtfsTripId: string,
        tripRoutes: GtfsTripRoutesData
    ): boolean {
        const id = entity.vehicle?.trip?.tripId;
        if (!id) return false;
        return id === gtfsTripId || tripRoutes.tripAliases?.[id] === gtfsTripId;
    }

    protected override matchesVehicleId(entity: transit_realtime.IFeedEntity, vehicleId: string): boolean {
        const descriptor = entity.vehicle?.vehicle;
        return descriptor?.id === vehicleId
            || descriptor?.label === vehicleId
            || descriptor?.licensePlate === vehicleId
            || entity.id === vehicleId;
    }

    /**
     * Resolves the correct trip information from the api mapping using the final or raw trip ID.
     */
    private findTripInfo(tripId: string, rawTripId: string | undefined, tripLookup: Record<string, ApiTrip> | null): ApiTrip | undefined {
        if (!tripLookup) return undefined;
        return tripLookup[tripId] || (rawTripId ? tripLookup[rawTripId] : undefined);
    }
}
