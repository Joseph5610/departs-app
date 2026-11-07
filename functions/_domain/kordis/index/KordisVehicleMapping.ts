import type * as GtfsRt from '../../../_core/gtfsRtTypes';
import type { MappingSchedule, VehicleMapping } from '../../gtfs/index/VehicleIndex';
import { dayBit, isWaitingToStart, isWithinMatchWindow, operatesOnDay, type ScheduleTrip } from '../../../_feeds/gtfs/schedule';
import { GTFS_CONFIG } from '../../../_feeds/gtfs/config';
import { DAY_MINS } from '../../../_core/utils/time';
import { DAY_S, wrapDaySeconds } from '../../../../shared/time';

interface TripClaim {
    label: string;
    /** The entity's position in the feed. */
    index: number;
    tripId: string;
    /** The readings of the entity's raw id naming this trip, as bits: bit 0 the id itself, bit k the k-th older export. */
    readings: number;
    gapMins: number;
}

/**
 * KORDIS quirks: vehicles appear several times under ids from different timetable exports, and the
 * feed carries entries for vehicles that are not in service.
 */
export class KordisVehicleMapping implements VehicleMapping {
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
     * to in each older numbering, newest first. Ids are recycled across exports, so several can be
     * valid at once and the choice is left to `assignAll`. An alias of null marks a dropped trip.
     */
    tripCandidates(entity: GtfsRt.IFeedEntity, mappingSchedule: MappingSchedule): string[] {
        return this.readings(entity, mappingSchedule).map((candidate) => candidate.tripId);
    }

    /** Each trip within its match window that a reading of the entity's raw id names, with those readings as bits. */
    private readings(entity: GtfsRt.IFeedEntity, { schedule, tripAliases, clock }: MappingSchedule): Array<{ tripId: string; readings: number }> {
        const rawTripId = entity.vehicle?.trip?.tripId;
        if (!rawTripId) return [];

        const named: Array<string | undefined> = [rawTripId];
        for (const aliases of tripAliases) {
            const alias = aliases.get(rawTripId);
            if (alias === null) return [];
            named.push(alias);
        }
        const candidates: Array<{ tripId: string; readings: number }> = [];
        for (let reading = 0; reading < named.length; reading++) {
            const tripId = named[reading];
            if (!tripId) continue;
            const trip = schedule.trips[tripId];
            if (!trip || !isWithinMatchWindow(trip, clock.mins)) continue;
            const known = candidates.find((candidate) => candidate.tripId === tripId);
            if (known) known.readings |= 1 << reading;
            else candidates.push({ tripId, readings: 1 << reading });
        }
        return candidates;
    }

    /** KORDIS pads its stop ids ("U01611Z01"); the timetable writes them unpadded ("U1611Z1"). */
    stopId(entity: GtfsRt.IFeedEntity): string | undefined {
        return entity.vehicle?.stopId?.replace(/U0*(\d+)/i, 'U$1').replace(/Z0*(\d+)/i, 'Z$1');
    }

    label(entity: GtfsRt.IFeedEntity): string | undefined {
        const vp = entity.vehicle;
        return vp?.vehicle?.label || vp?.vehicle?.licensePlate || vp?.vehicle?.id || entity.id || undefined;
    }

    /** At its origin, waiting for a departure that has not come yet. */
    isBeforeTrack(tripId: string, { schedule, clock }: MappingSchedule): boolean {
        const window = schedule.trips[tripId];
        if (!window) return false;

        return isWaitingToStart(wrapDaySeconds(((window[0] % DAY_MINS) - (clock.mins % DAY_MINS)) * 60) / 60);
    }

    /**
     * Picks one trip per vehicle such that no trip is served by two vehicles.
     *
     * KORDIS emits every vehicle several times, each entity carrying the run's trip id from a
     * different export numbering, and the feed can lag several exports behind. Resolved independently,
     * a stale id on one vehicle can alias onto the trip another vehicle is really driving. Claims are
     * granted strongest first - running now, then the reading of the numbering the feed is currently
     * on, then nearest window - and a vehicle whose best reading is taken falls back to its next one.
     */
    assignAll(entities: GtfsRt.IFeedEntity[], mappingSchedule: MappingSchedule) {
        const { schedule, clock } = mappingSchedule;
        const todayBit = dayBit(schedule, clock.date);
        const currentMins = clock.mins;

        // Grouped by vehicle first, then by the order the feed lists them: equally strong claims are
        // decided by this order, so it has to be the same one every time.
        const byVehicle = new Map<string, number[]>();
        const nowMs = Date.now();
        for (let i = 0; i < entities.length; i++) {
            const vp = entities[i].vehicle;
            if (!vp) continue;

            const lastUpdate = vp.timestamp ? Number(vp.timestamp) * 1000 : nowMs;
            if (nowMs - lastUpdate > GTFS_CONFIG.VEHICLES_STALE_THRESHOLD_MS) continue;

            const label = this.label(entities[i]);
            if (!label) continue;

            const group = byVehicle.get(label);
            if (group) group.push(i);
            else byVehicle.set(label, [i]);
        }

        const claims: TripClaim[] = [];
        for (const [label, group] of sortedByLabel(byVehicle)) {
            for (const index of group) {
                for (const { tripId, readings } of this.readings(entities[index], mappingSchedule)) {
                    claims.push({
                        label,
                        index,
                        tripId,
                        readings,
                        gapMins: this.windowGap(schedule.trips[tripId], todayBit, currentMins),
                    });
                }
            }
        }

        const preferred = this.feedReading(claims, 1 + mappingSchedule.tripAliases.length);
        const eligible = this.withoutFallbacks(claims, entities, mappingSchedule, preferred);
        const order = claimOrder(eligible, preferred);

        const tripOf: Array<string | undefined> = new Array(entities.length);
        const takenVehicles = new Set<string>();
        const takenTrips = new Set<string>();
        for (let k = 0; k < order.length; k++) {
            const claim = eligible[order[k]];
            if (takenVehicles.has(claim.label) || takenTrips.has(claim.tripId)) continue;
            takenVehicles.add(claim.label);
            takenTrips.add(claim.tripId);
            tripOf[claim.index] = claim.tripId;
        }

        // Strength decided the claims; the answer keeps the feed's own order.
        const assigned: Array<{ entity: GtfsRt.IFeedEntity; tripId: string }> = [];
        for (let i = 0; i < entities.length; i++) {
            const tripId = tripOf[i];
            if (tripId !== undefined) assigned.push({ entity: entities[i], tripId });
        }
        return assigned;
    }

    /**
     * Which numbering the feed is on right now (0 its own ids, k the k-th older export), voted by entities
     * where only one reading is running.
     *
     * KORDIS sometimes broadcasts the current export's ids and sometimes lags one or more exports behind;
     * when several readings of an id run at once, the feed-wide majority decides which one it means. A tie
     * goes to the newer numbering.
     */
    private feedReading(claims: TripClaim[], readingCount: number): number {
        const running = new Map<number, number>();
        for (const claim of claims) {
            if (claim.gapMins === 0) running.set(claim.index, (running.get(claim.index) ?? 0) | claim.readings);
        }
        const votes = new Array<number>(readingCount).fill(0);
        for (const readings of running.values()) {
            if ((readings & (readings - 1)) === 0) votes[31 - Math.clz32(readings)]++;
        }
        let preferred = 0;
        for (let reading = 1; reading < readingCount; reading++) {
            if (votes[reading] > votes[preferred]) preferred = reading;
        }
        return preferred;
    }

    /**
     * Drops an entity's claims on its other readings when the reading the feed is on names a trip outside the
     * match window: that vehicle is not in service, and moving it onto another numbering's trip would show it on
     * a trip it is not driving. A running other reading stays, as it always outranks a far one.
     */
    private withoutFallbacks(claims: TripClaim[], entities: GtfsRt.IFeedEntity[], { tripAliases }: MappingSchedule, preferred: number): TripClaim[] {
        const hasPreferred = new Set<number>();
        for (const claim of claims) if (isReading(claim, preferred)) hasPreferred.add(claim.index);
        return claims.filter((claim) => {
            if (isReading(claim, preferred) || claim.gapMins === 0 || hasPreferred.has(claim.index)) return true;
            const rawTripId = entities[claim.index].vehicle?.trip?.tripId;
            if (!rawTripId) return true;
            if (preferred === 0) return false;
            const alias = tripAliases[preferred - 1].get(rawTripId);
            return !alias || alias === rawTripId;
        });
    }

    /** Minutes between now and a trip's window today: 0 while running, Infinity if it does not run today. */
    private windowGap(window: ScheduleTrip | undefined, todayBit: number, currentMins: number): number {
        if (!window) return Infinity;
        if (todayBit && !operatesOnDay(window, todayBit)) return Infinity;
        if (currentMins < window[0]) return window[0] - currentMins;
        if (currentMins > window[1]) return currentMins - window[1];
        return 0;
    }
}


/**
 * Vehicles in numeric order where their ids are numbers, then the rest as the feed lists them.
 *
 * Equally strong claims are decided by this order, and numbered vehicles come first because that is
 * the order the board has always resolved them in.
 */
function sortedByLabel(byVehicle: Map<string, number[]>): Array<[string, number[]]> {
    const numeric: Array<[string, number[]]> = [];
    const rest: Array<[string, number[]]> = [];
    for (const entry of byVehicle) {
        (/^\d+$/.test(entry[0]) ? numeric : rest).push(entry);
    }
    numeric.sort((a, b) => Number(a[0]) - Number(b[0]));
    return [...numeric, ...rest];
}

/** Whether the claim's trip is the one `reading` of the entity's raw id names. */
function isReading(claim: TripClaim, reading: number): boolean {
    return (claim.readings & (1 << reading)) !== 0;
}

/** Longest gap a claim's sort key tells apart, past any GTFS service day; longer ones (and Infinity) tie. */
const MAX_KEYED_GAP_SECS = 3 * DAY_S;

/**
 * Claim indexes strongest first: running now, then the reading the feed is on, then nearest window,
 * ties kept in claim order. One numeric key per claim sorted natively, since a comparator sort over
 * every claim was the costliest step of a fleet build.
 */
function claimOrder(claims: TripClaim[], preferred: number): Uint32Array {
    const count = claims.length;
    const keys = new Float64Array(count);
    for (let i = 0; i < count; i++) {
        const { gapMins } = claims[i];
        const isPreferred = isReading(claims[i], preferred);
        // Gaps are whole seconds: windows are whole minutes and the clock whole seconds.
        const gap = Math.min(Math.round(gapMins * 60), MAX_KEYED_GAP_SECS + 1);
        const rank = (gapMins > 0 ? 2 : 0) + (isPreferred ? 0 : 1);
        keys[i] = ((rank * (MAX_KEYED_GAP_SECS + 2) + gap) * count) + i;
    }
    keys.sort();

    const order = new Uint32Array(count);
    for (let i = 0; i < count; i++) order[i] = keys[i] % count;
    return order;
}
