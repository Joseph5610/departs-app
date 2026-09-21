import type { transit_realtime } from 'gtfs-realtime-bindings';
import type { VehicleMapping } from './vehicle-index';
import type { GtfsTripRoutesData } from '../../../_feeds/gtfs/gtfs-data';

/** A plain GTFS-RT feed: the trip id it reports is the trip, and every entity counts. */
export class GtfsVehicleMapping implements VehicleMapping {
    /** A plain feed names the trip outright, so no vehicle can be claimed by two of them. */
    readonly resolvesPerEntity = true;

    isRelevant(_entity: transit_realtime.IFeedEntity): boolean {
        return true;
    }

    tripCandidates(entity: transit_realtime.IFeedEntity, tripRoutes: GtfsTripRoutesData): string[] {
        const tripId = entity.vehicle?.trip?.tripId;
        return tripId && tripId in tripRoutes.tripRoutes ? [tripId] : [];
    }

    label(_entity: transit_realtime.IFeedEntity): string | undefined {
        return undefined;
    }

    matchesVehicle(entity: transit_realtime.IFeedEntity, vehicleId: string): boolean {
        const descriptor = entity.vehicle?.vehicle;
        return descriptor?.id === vehicleId || descriptor?.label === vehicleId || entity.id === vehicleId;
    }

    async isBeforeTrack(_tripId: string): Promise<boolean> {
        return false;
    }

    async assignAll(entities: transit_realtime.IFeedEntity[], tripRoutes: GtfsTripRoutesData) {
        const assigned: Array<{ entity: transit_realtime.IFeedEntity; tripId: string }> = [];
        for (const entity of entities) {
            const tripId = this.tripCandidates(entity, tripRoutes)[0];
            if (tripId) assigned.push({ entity, tripId });
        }
        return assigned;
    }
}
