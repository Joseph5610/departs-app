import type * as GtfsRt from '../../../_core/gtfsRtTypes';
import type { MappingSchedule, VehicleMapping } from './vehicle-index';
import { isWithinMatchWindow } from '../../../_feeds/gtfs/schedule';

/** A plain GTFS-RT feed: the trip id it reports is the trip, and every entity counts. */
export class GtfsVehicleMapping implements VehicleMapping {
    /** A plain feed names the trip outright, so no vehicle can be claimed by two of them. */
    readonly resolvesPerEntity = true;

    isRelevant(_entity: GtfsRt.IFeedEntity): boolean {
        return true;
    }

    tripCandidates(entity: GtfsRt.IFeedEntity, { schedule, clock }: MappingSchedule): string[] {
        const tripId = entity.vehicle?.trip?.tripId;
        const trip = tripId ? schedule.trips[tripId] : undefined;
        return tripId && trip && isWithinMatchWindow(trip, clock.mins) ? [tripId] : [];
    }

    label(_entity: GtfsRt.IFeedEntity): string | undefined {
        return undefined;
    }

    matchesVehicle(entity: GtfsRt.IFeedEntity, vehicleId: string): boolean {
        const descriptor = entity.vehicle?.vehicle;
        return descriptor?.id === vehicleId || descriptor?.label === vehicleId || entity.id === vehicleId;
    }

    isBeforeTrack(): boolean {
        return false;
    }

    assignAll(entities: GtfsRt.IFeedEntity[], schedule: MappingSchedule) {
        const assigned: Array<{ entity: GtfsRt.IFeedEntity; tripId: string }> = [];
        for (const entity of entities) {
            const tripId = this.tripCandidates(entity, schedule)[0];
            if (tripId) assigned.push({ entity, tripId });
        }
        return assigned;
    }
}
