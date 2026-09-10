import type { AppVehicleCollection, AppVehicleFeature } from "../../../../_core/types";
import type { transit_realtime } from 'gtfs-realtime-bindings';
import { VehiclesService } from '../../../gtfs/services/vehicles/VehiclesService';
import { CacheManager, CACHE_TTL } from '../../../../_core/utils/CacheManager';
import { appClient } from '../../../../_core/ApiClient';
import { VehiclesMapper } from '../../../gtfs/services/vehicles/VehiclesMapper';
import type { TripWindow, TripWindows } from '../types';
import { GTFS_CONFIG } from '../../../gtfs/core/config';
import { getCurrentLocalSeconds, getZonedDateString } from '../../../gtfs/core/utils';
import type { GtfsTripRoutesData } from '../../../gtfs/core/gtfs-data';

export class KordisGtfsRtVehiclesService extends VehiclesService {
    
    /**
     * Fetches the compact trip operating windows.
     *
     * Keyed by trip_id, so it needs no lookup build, and it carries only the fields actually read.
     * This replaced api.json, which cost ~37ms of CPU per cold isolate to parse and index - far too
     * much when the whole request budget is 10ms and the cache is per-isolate.
     */
    private async getTripWindows(): Promise<TripWindows | null> {
        const staticUrl = this.city.adapterConfig?.staticDataUrl;
        if (!staticUrl) return null;

        const url = `${staticUrl}/${this.city.slug}/trip_windows.json`;

        return CacheManager.getOrFetch<TripWindows | null>(
            `trip_windows_${this.city.slug}`,
            CACHE_TTL.TWO_HOURS_MS,
            async () => {
                try {
                    const res = await appClient.fetch(url, { cf: { cacheTtl: 7200 } });
                    if (!res.ok) {
                        console.error(`Failed to fetch trip_windows.json for ${this.city.slug}: ${res.status}`);
                        return null;
                    }
                    return JSON.parse(await res.text()) as TripWindows;
                } catch (e) {
                    console.error("Failed to fetch trip_windows.json", e);
                    return null;
                }
            },
            (data) => !data || Object.keys(data.trips).length === 0
        );
    }

    /**
     * Resolves the bit representing `todayStr` within a windows file, or 0 when the file predates
     * today - in which case no trip matches, mirroring the previous date-string comparison.
     */
    private static todayBit(windows: TripWindows, todayStr: string): number {
        const idx = windows.days.indexOf(todayStr);
        return idx < 0 ? 0 : 1 << idx;
    }

    /** Whether a trip operates on the day represented by `todayBit`. */
    private static operatesToday(window: TripWindow, todayBit: number): boolean {
        const flags = window[2];
        return flags === -1 || (flags & todayBit) !== 0;
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
        windows: TripWindows,
        todayBit: number,
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

            const window = windows.trips[tripId];

            if (window) {
                if (KordisGtfsRtVehiclesService.operatesToday(window, todayBit)) {
                    let diff = 0;
                    if (currentMins < window[0]) diff = window[0] - currentMins;
                    else if (currentMins > window[1]) diff = currentMins - window[1];

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
                const [[feed, gtfsData, tripRoutesObj], windows] = await Promise.all([
                    this.getCoreData(),
                    this.getTripWindows()
                ]);

                if (!feed || !feed.entity) {
                    return { type: 'FeatureCollection', features: [], status: 'upstream_offline' };
                }

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

                let todayBit = 0;
                let currentMins = 0;

                if (windows) {
                    const ctx = this.getCurrentTimeContext();
                    todayBit = KordisGtfsRtVehiclesService.todayBit(windows, ctx.todayLocalStr);
                    currentMins = ctx.currentMinutes;
                }

                const keys = Object.keys(groupedEntities);
                for (let i = 0; i < keys.length; i++) {
                    const label = keys[i];
                    const entities = groupedEntities[label];

                    const selectedEntity = (entities.length > 1 && windows)
                        ? this.selectBestEntity(entities, windows, todayBit, currentMins, tripRoutesObj)
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
                    
                    // Copy, never write through: `vp` belongs to the FeedMessage CacheManager shares
                    // with the alerts and detail paths.
                    const mappable: transit_realtime.IVehiclePosition = vp.vehicle
                        ? { ...vp, vehicle: { ...vp.vehicle, id: label } }
                        : vp;

                    const window = this.findTripWindow(tripId, rawTripId, windows);
                    const isBeforeTrack = this.isVehicleBeforeTrack(window, currentMins);

                    const liveMatch = VehiclesMapper.mapVehicle(mappable, tripId, route, originTimestamp, null, isBeforeTrack);

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
    private isVehicleBeforeTrack(window: TripWindow | undefined, currentMins: number): boolean {
        if (!window) return false;

        const start = window[0] % 1440;
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
     * Resolves a trip's operating window using the final or raw trip ID.
     */
    private findTripWindow(tripId: string, rawTripId: string | undefined, windows: TripWindows | null): TripWindow | undefined {
        if (!windows) return undefined;
        return windows.trips[tripId] || (rawTripId ? windows.trips[rawTripId] : undefined);
    }
}
