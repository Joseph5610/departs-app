import type { AppVehicleCollection, AppVehicleFeature } from "../../../../_core/types";
import type { transit_realtime } from 'gtfs-realtime-bindings';
import { VehiclesService } from '../../../gtfs/services/vehicles/VehiclesService';
import { CacheManager, MEMORY_CACHE_TTL } from '../../../../_core/utils/CacheManager';
import { VehiclesMapper } from '../../../gtfs/services/vehicles/VehiclesMapper';
import { getTripWindows, dayBit, operatesOnDay, type TripWindow, type TripWindows } from '../../../gtfs/core/trip-windows';
import { GTFS_CONFIG } from '../../../gtfs/core/config';
import { DAY_MINS, getLocalClock, wrapDaySeconds } from '../../../../_core/utils/time';
import type { GtfsRoutesData, GtfsTripRoutesData } from '../../../gtfs/core/gtfs-data';

interface TripClaim {
    label: string;
    entity: transit_realtime.IFeedEntity;
    tripId: string;
    isNative: boolean;
    gapMins: number;
}

export class KordisGtfsRtVehiclesService extends VehiclesService {
    /**
     * Trip ids a raw feed id may stand for in the current export: itself, and the trip its run maps
     * to when the id comes from an older numbering. Ids are recycled across exports, so both can be
     * valid at once and the choice is left to `assignTrips`. An alias of null marks a dropped trip.
     */
    private candidateTripIds(rawTripId: string, tripRoutes: GtfsTripRoutesData): string[] {
        const alias = tripRoutes.tripAliases?.[rawTripId];
        if (alias === null) return [];
        const candidates: string[] = [];
        if (rawTripId in tripRoutes.tripRoutes) candidates.push(rawTripId);
        if (alias && alias !== rawTripId && alias in tripRoutes.tripRoutes) candidates.push(alias);
        return candidates;
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
     * Picks one trip per vehicle such that no trip is served by two vehicles.
     *
     * KORDIS emits every vehicle several times, each entity carrying the run's trip id from a
     * different export numbering. Resolved independently, a stale id on one vehicle can alias onto
     * the trip another vehicle is really driving. Claims are granted strongest first - running now,
     * then an id native to the current export over an aliased one, then nearest window - and a
     * vehicle whose best reading is taken falls back to its next one.
     */
    private assignTrips(
        groupedEntities: Record<string, transit_realtime.IFeedEntity[]>,
        tripRoutesObj: GtfsTripRoutesData,
        windows: TripWindows | null,
        todayBit: number,
        currentMins: number,
    ): Map<string, { entity: transit_realtime.IFeedEntity; tripId: string }> {
        const claims: TripClaim[] = [];
        for (const label of Object.keys(groupedEntities)) {
            for (const entity of groupedEntities[label]) {
                const rawTripId = entity.vehicle?.trip?.tripId;
                if (!rawTripId) continue;
                for (const tripId of this.candidateTripIds(rawTripId, tripRoutesObj)) {
                    claims.push({
                        label,
                        entity,
                        tripId,
                        isNative: tripId === rawTripId,
                        gapMins: this.windowGap(windows?.trips[tripId], todayBit, currentMins),
                    });
                }
            }
        }

        claims.sort((a, b) =>
            Number(a.gapMins > 0) - Number(b.gapMins > 0)
            || Number(b.isNative) - Number(a.isNative)
            || a.gapMins - b.gapMins);

        const assigned = new Map<string, { entity: transit_realtime.IFeedEntity; tripId: string }>();
        const takenTrips = new Set<string>();
        for (const claim of claims) {
            if (assigned.has(claim.label) || takenTrips.has(claim.tripId)) continue;
            assigned.set(claim.label, { entity: claim.entity, tripId: claim.tripId });
            takenTrips.add(claim.tripId);
        }
        return assigned;
    }

    /** Minutes between now and a trip's window today: 0 while running, Infinity if it does not run today. */
    private windowGap(window: TripWindow | undefined, todayBit: number, currentMins: number): number {
        if (!window) return Infinity;
        if (todayBit && !operatesOnDay(window, todayBit)) return Infinity;
        if (currentMins < window[0]) return window[0] - currentMins;
        if (currentMins > window[1]) return currentMins - window[1];
        return 0;
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
                    const clock = getLocalClock(this.city.timezone);
                    todayBit = dayBit(windows, clock.date);
                    currentMins = clock.mins;
                }

                const assignments = this.assignTrips(groupedEntities, tripRoutesObj, windows, todayBit, currentMins);
                for (const [label, { entity: selectedEntity, tripId }] of assignments) {
                    const vp = selectedEntity.vehicle;
                    if (!vp) continue;

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

    protected override resolveEntityTripId(
        entity: transit_realtime.IFeedEntity,
        requestedTripId: string | undefined,
        tripRoutes: GtfsTripRoutesData
    ): string | undefined {
        const rawTripId = entity.vehicle?.trip?.tripId;
        if (!rawTripId) return undefined;
        const candidates = this.candidateTripIds(rawTripId, tripRoutes);
        // The client named the trip it opened, so an id recycled across exports resolves to that one.
        return requestedTripId && candidates.includes(requestedTripId) ? requestedTripId : candidates[0];
    }

    protected override async mapLiveEntity(
        entity: transit_realtime.IFeedEntity,
        tripId: string,
        gtfsData: GtfsRoutesData,
        tripRoutes: GtfsTripRoutesData
    ): Promise<AppVehicleFeature | null> {
        const vp = entity.vehicle;
        if (!vp || this.isInvalidDpmbVehicle(entity)) return null;

        const mapped = await super.mapLiveEntity(entity, tripId, gtfsData, tripRoutes);
        if (!mapped) return null;

        const windows = await getTripWindows(this.city);
        const isBeforeTrack = this.isVehicleBeforeTrack(this.findTripWindow(tripId, windows), getLocalClock(this.city.timezone).mins);
        const label = vp.vehicle?.label || vp.vehicle?.licensePlate || vp.vehicle?.id || entity.id;
        const route = gtfsData.routes[tripRoutes.tripRoutes[tripId]];
        // Copy, never write through: `vp` belongs to the FeedMessage CacheManager shares.
        const mappable: transit_realtime.IVehiclePosition = vp.vehicle ? { ...vp, vehicle: { ...vp.vehicle, id: label } } : vp;
        return VehiclesMapper.mapVehicle(mappable, tripId, route, mapped.properties.origin_timestamp ?? new Date().toISOString(), null, isBeforeTrack);
    }

    /**
     * Checks if vehicle is at origin before departure.
     */
    private isVehicleBeforeTrack(window: TripWindow | undefined, currentMins: number): boolean {
        if (!window) return false;

        const diffMins = wrapDaySeconds(((window[0] % DAY_MINS) - (currentMins % DAY_MINS)) * 60) / 60;

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
