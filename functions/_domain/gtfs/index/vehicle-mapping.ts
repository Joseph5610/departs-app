import type * as GtfsRt from '../../../_core/gtfsRtTypes';
import type { VehicleMapping } from './vehicle-index';
import type { GtfsTripRoutesData } from '../../../_feeds/gtfs/gtfs-data';

/** A plain GTFS-RT feed: the trip id it reports is the trip, and every entity counts. */
export class GtfsVehicleMapping implements VehicleMapping {
    /** A plain feed names the trip outright, so no vehicle can be claimed by two of them. */
    readonly resolvesPerEntity = true;
    readonly usesTripWindows = false;

    isRelevant(_entity: GtfsRt.IFeedEntity): boolean {
        return true;
    }

    tripCandidates(entity: GtfsRt.IFeedEntity, tripRoutes: GtfsTripRoutesData): string[] {
        const tripId = entity.vehicle?.trip?.tripId;
        return tripId && tripId in tripRoutes.tripRoutes ? [tripId] : [];
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

    assignAll(entities: GtfsRt.IFeedEntity[], tripRoutes: GtfsTripRoutesData) {
        const assigned: Array<{ entity: GtfsRt.IFeedEntity; tripId: string }> = [];
        for (const entity of entities) {
            const tripId = this.tripCandidates(entity, tripRoutes)[0];
            if (tripId) assigned.push({ entity, tripId });
        }
        return assigned;
    }
}
