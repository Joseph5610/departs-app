import type { AppVehicleCollection, AppVehicleFeature } from '../../../_core/types';

/** A live-vehicle result, as `VehiclesService.getSingleLiveVehicle` returns it. */
export interface SingleLiveVehicle {
    liveMatch?: AppVehicleFeature;
    lastStopId?: string;
}

/**
 * Where a network's vehicles come from: a GTFS-RT feed, Prešov's CSV export, DÚK's Portabo feed.
 * `VehiclesService` composes one of these; filtering, stats and the live/detail lookups are shared.
 */
export interface VehicleSource {
    /** Every vehicle in the network, as the source last gave them. */
    all(): Promise<AppVehicleCollection>;
    /**
     * The vehicles serving the given trips, for departure boards; null once the source is too old to
     * serve positions. Omitted where reading the whole network is no dearer: answered from `all()`.
     */
    forTrips?(tripIds: Set<string>): Promise<AppVehicleCollection | null>;
    /** One vehicle, for a detail request. Omitted: looked up in `all()`. */
    find?(vehicleId: string, gtfsTripId?: string): Promise<SingleLiveVehicle>;
    /** Extra detail a network's own feed can add to a match already found. */
    augmentSingleLiveVehicle?(result: SingleLiveVehicle): Promise<SingleLiveVehicle>;
}
