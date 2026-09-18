import type { AppVehicleCollection, AppVehicleFeature } from "../../../../_core/types";
import type { transit_realtime } from 'gtfs-realtime-bindings';
import { VehiclesService } from '../../../gtfs/services/vehicles/VehiclesService';
import { CacheManager, MEMORY_CACHE_TTL } from '../../../../_core/utils/CacheManager';
import { VehiclesMapper } from '../../../gtfs/services/vehicles/VehiclesMapper';
import { getTripWindows, dayBit, operatesOnDay, type TripWindow, type TripWindows } from '../../../gtfs/core/trip-windows';
import { GTFS_CONFIG } from '../../../gtfs/core/config';
import { getCurrentLocalSeconds, getZonedDateString, wrapDaySeconds } from '../../../../_core/utils/time';
import type { GtfsTripRoutesData } from '../../../gtfs/core/gtfs-data';

export class KordisGtfsRtVehiclesService extends VehiclesService {
    
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
     * KORDIS renumbers nearly every trip on each export while the feed keeps emitting the previous
     * numbering, so a raw id being present in `tripRoutes` does NOT mean it is the same trip - it is
     * usually a different one that inherited the number. The alias table, built from the operator's
     * own run id, carries the intended trip.
     *
     * Both readings are plausible because ids get recycled, and which one is right depends on
     * whether the feed has caught up with the export. Rather than assume, prefer whichever one is
     * actually running: that keeps working when the feed still lags AND once it catches up.
     * Returns null only when the alias table explicitly marks the trip as dropped.
     */
    private resolveTripId(
        rawTripId: string,
        tripRoutes: GtfsTripRoutesData,
        windows: TripWindows | null,
        todayBit: number,
        currentMins: number,
    ): string | null {
        const alias = tripRoutes.tripAliases?.[rawTripId];
        if (alias === undefined) return rawTripId;
        if (alias === null) return null;

        const rawIsCurrentTrip = Boolean(tripRoutes.tripRoutes && rawTripId in tripRoutes.tripRoutes);
        if (!rawIsCurrentTrip || !windows) return alias;

        // Recycled id: only the raw reading wins, and only while it is the one in service.
        const rawRunning = this.isRunning(windows.trips[rawTripId], todayBit, currentMins);
        const aliasRunning = this.isRunning(windows.trips[alias], todayBit, currentMins);
        return rawRunning && !aliasRunning ? rawTripId : alias;
    }

    /** Whether a trip operates today and the current time falls inside its window. */
    private isRunning(window: TripWindow | undefined, todayBit: number, currentMins: number): boolean {
        if (!window) return false;
        if (todayBit && !operatesOnDay(window, todayBit)) return false;
        return currentMins >= window[0] && currentMins <= window[1];
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
            
            const tripId = this.resolveTripId(rawTripId, tripRoutesObj, windows, todayBit, currentMins);
            if (!tripId) continue; // dropped trip

            const window = windows.trips[tripId];

            if (window) {
                if (operatesOnDay(window, todayBit)) {
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
            MEMORY_CACHE_TTL.SHORT_DEBOUNCE_MS, 
            async () => {
                const [[feed, gtfsData, tripRoutesObj], windows] = await Promise.all([
                    this.getCoreData(),
                    getTripWindows(this.city)
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
                    todayBit = dayBit(windows, ctx.todayLocalStr);
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

                    const tripId = this.resolveTripId(rawTripId, tripRoutesObj, windows, todayBit, currentMins);
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

                    const window = this.findTripWindow(tripId, windows);
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

        const diffMins = wrapDaySeconds(((window[0] % 1440) - (currentMins % 1440)) * 60) / 60;

        return diffMins > 1 && diffMins <= GTFS_CONFIG.BEFORE_TRACK_WINDOW_MINS;
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
    /** The raw id is not a fallback: after a renumbering its window belongs to an unrelated trip. */
    private findTripWindow(tripId: string, windows: TripWindows | null): TripWindow | undefined {
        return windows ? windows.trips[tripId] : undefined;
    }
}
