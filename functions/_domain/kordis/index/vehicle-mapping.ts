import type * as GtfsRt from '../../../_core/gtfsRtTypes';
import type { MappingSchedule, VehicleMapping } from '../../gtfs/index/vehicle-index';
import type { GtfsTripRoutesData } from '../../../_feeds/gtfs/gtfs-data';
import { dayBit, operatesOnDay, type TripWindow, type TripWindows } from '../../../_feeds/gtfs/trip-windows';
import { GTFS_CONFIG } from '../../../_feeds/gtfs/config';
import { DAY_MINS, wrapDaySeconds } from '../../../_core/utils/time';

interface TripClaim {
    label: string;
    entity: GtfsRt.IFeedEntity;
    tripId: string;
    isNative: boolean;
    gapMins: number;
}

/**
 * KORDIS quirks: vehicles appear several times under ids from different timetable exports, and the
 * feed carries entries for vehicles that are not in service.
 */
export class KordisVehicleMapping implements VehicleMapping {
    /** Its vehicles appear under several trip ids, so only the network-wide assignment settles them. */
    readonly resolvesPerEntity = false;
    readonly usesTripWindows = true;


    /** License plates starting with `dpmb` mark feed entries that are not real vehicles. */
    private isInvalidDpmbVehicle(entity: GtfsRt.IFeedEntity): boolean {
        const lp = entity.vehicle?.vehicle?.licensePlate;
        return !!lp && lp.trim().toLowerCase().startsWith('dpmb');
    }

    isRelevant(entity: GtfsRt.IFeedEntity): boolean {
        return !this.isInvalidDpmbVehicle(entity);
    }

    /**
     * Trip ids a raw feed id may stand for in the current export: itself, and the trip its run maps
     * to when the id comes from an older numbering. Ids are recycled across exports, so both can be
     * valid at once and the choice is left to `assignAll`. An alias of null marks a dropped trip.
     */
    tripCandidates(entity: GtfsRt.IFeedEntity, tripRoutes: GtfsTripRoutesData): string[] {
        const rawTripId = entity.vehicle?.trip?.tripId;
        if (!rawTripId) return [];

        const alias = tripRoutes.tripAliases?.[rawTripId];
        if (alias === null) return [];
        const candidates: string[] = [];
        if (rawTripId in tripRoutes.tripRoutes) candidates.push(rawTripId);
        if (alias && alias !== rawTripId && alias in tripRoutes.tripRoutes) candidates.push(alias);
        return candidates;
    }

    label(entity: GtfsRt.IFeedEntity): string | undefined {
        const vp = entity.vehicle;
        return vp?.vehicle?.label || vp?.vehicle?.licensePlate || vp?.vehicle?.id || entity.id || undefined;
    }

    matchesVehicle(entity: GtfsRt.IFeedEntity, vehicleId: string): boolean {
        const descriptor = entity.vehicle?.vehicle;
        return descriptor?.id === vehicleId
            || descriptor?.label === vehicleId
            || descriptor?.licensePlate === vehicleId
            || entity.id === vehicleId;
    }

    /** At its origin, waiting for a departure that has not come yet. */
    isBeforeTrack(tripId: string, { windows, clock }: MappingSchedule): boolean {
        const window = windows?.trips[tripId];
        if (!window) return false;

        const currentMins = clock.mins;
        const diffMins = wrapDaySeconds(((window[0] % DAY_MINS) - (currentMins % DAY_MINS)) * 60) / 60;
        return diffMins > 1 && diffMins <= GTFS_CONFIG.BEFORE_TRACK_WINDOW_MINS;
    }

    /**
     * Picks one trip per vehicle such that no trip is served by two vehicles.
     *
     * KORDIS emits every vehicle several times, each entity carrying the run's trip id from a
     * different export numbering. Resolved independently, a stale id on one vehicle can alias onto
     * the trip another vehicle is really driving. Claims are granted strongest first - running now,
     * then the reading of the numbering the feed is currently on, then nearest window - and a
     * vehicle whose best reading is taken falls back to its next one.
     */
    assignAll(entities: GtfsRt.IFeedEntity[], tripRoutes: GtfsTripRoutesData, { windows, clock }: MappingSchedule) {
        const todayBit = windows ? dayBit(windows, clock.date) : 0;
        const currentMins = windows ? clock.mins : 0;

        // Grouped by vehicle first, then by the order the feed lists them: equally strong claims are
        // decided by this order, so it has to be the same one every time.
        const byVehicle = new Map<string, GtfsRt.IFeedEntity[]>();
        const order = new Map<GtfsRt.IFeedEntity, number>();
        const nowMs = Date.now();
        for (const entity of entities) {
            order.set(entity, order.size);
            const vp = entity.vehicle;
            if (!vp) continue;

            const lastUpdate = vp.timestamp ? Number(vp.timestamp) * 1000 : nowMs;
            if (nowMs - lastUpdate > GTFS_CONFIG.VEHICLES_STALE_THRESHOLD_MS) continue;

            const label = this.label(entity);
            if (!label) continue;

            const group = byVehicle.get(label);
            if (group) group.push(entity);
            else byVehicle.set(label, [entity]);
        }

        const claims: TripClaim[] = [];
        for (const [label, group] of sortedByLabel(byVehicle)) {
            for (const entity of group) {
                for (const tripId of this.tripCandidates(entity, tripRoutes)) {
                    claims.push({
                        label,
                        entity,
                        tripId,
                        isNative: tripId === entity.vehicle?.trip?.tripId,
                        gapMins: this.windowGap(windows?.trips[tripId], todayBit, currentMins),
                    });
                }
            }
        }

        const preferNative = this.feedReadsNative(claims);
        claims.sort((a, b) =>
            Number(a.gapMins > 0) - Number(b.gapMins > 0)
            || (preferNative ? Number(b.isNative) - Number(a.isNative) : Number(a.isNative) - Number(b.isNative))
            || a.gapMins - b.gapMins);

        const assigned: Array<{ entity: GtfsRt.IFeedEntity; tripId: string }> = [];
        const takenVehicles = new Set<string>();
        const takenTrips = new Set<string>();
        for (const claim of claims) {
            if (takenVehicles.has(claim.label) || takenTrips.has(claim.tripId)) continue;
            takenVehicles.add(claim.label);
            takenTrips.add(claim.tripId);
            assigned.push({ entity: claim.entity, tripId: claim.tripId });
        }
        // Strength decided the claims; the answer keeps the feed's own order.
        return assigned.sort((a, b) => (order.get(a.entity) ?? 0) - (order.get(b.entity) ?? 0));
    }

    /**
     * Which numbering the feed is on right now, voted by entities where only one reading is running.
     *
     * KORDIS sometimes broadcasts the current export's ids and sometimes lags a whole export behind;
     * when both readings of an id run at once, the feed-wide majority decides which one it means.
     */
    private feedReadsNative(claims: TripClaim[]): boolean {
        const running = new Map<GtfsRt.IFeedEntity, { native: boolean; alias: boolean }>();
        for (const claim of claims) {
            if (claim.gapMins !== 0) continue;
            const reading = running.get(claim.entity) ?? { native: false, alias: false };
            if (claim.isNative) reading.native = true;
            else reading.alias = true;
            running.set(claim.entity, reading);
        }
        let balance = 0;
        for (const { native, alias } of running.values()) {
            if (native !== alias) balance += native ? 1 : -1;
        }
        return balance >= 0;
    }

    /** Minutes between now and a trip's window today: 0 while running, Infinity if it does not run today. */
    private windowGap(window: TripWindow | undefined, todayBit: number, currentMins: number): number {
        if (!window) return Infinity;
        if (todayBit && !operatesOnDay(window, todayBit)) return Infinity;
        if (currentMins < window[0]) return window[0] - currentMins;
        if (currentMins > window[1]) return currentMins - window[1];
        return 0;
    }
}

export type { TripWindows };

/**
 * Vehicles in numeric order where their ids are numbers, then the rest as the feed lists them.
 *
 * Equally strong claims are decided by this order, and numbered vehicles come first because that is
 * the order the board has always resolved them in.
 */
function sortedByLabel(byVehicle: Map<string, GtfsRt.IFeedEntity[]>): Array<[string, GtfsRt.IFeedEntity[]]> {
    const numeric: Array<[string, GtfsRt.IFeedEntity[]]> = [];
    const rest: Array<[string, GtfsRt.IFeedEntity[]]> = [];
    for (const entry of byVehicle) {
        (/^\d+$/.test(entry[0]) ? numeric : rest).push(entry);
    }
    numeric.sort((a, b) => Number(a[0]) - Number(b[0]));
    return [...numeric, ...rest];
}
