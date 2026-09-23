import type { AppVehicleCollection, AppVehicleFeature } from '../../../_core/types';

/** A live-vehicle result, as `VehiclesService.getSingleLiveVehicle` returns it. */
export interface SingleLiveVehicle {
    liveMatch?: AppVehicleFeature;
    lastStopId?: string;
}

/** The whole fleet already serialized, without `status`, for a request that needs it unfiltered. */
export interface SerializedFleet {
    json: string;
    lastUpdated?: string;
}

/**
 * Where a network's vehicles come from: a GTFS-RT feed, Prešov's CSV export, DÚK's Portabo feed.
 * `VehiclesService` composes one of these; filtering, stats and the live/detail lookups are shared.
 */
export interface VehicleSource {
    /**
     * Every vehicle in the network, as the source last gave them. `waitUntil`, when given, lets a
     * source that caches its own expensive build refresh that cache in the background instead of
     * blocking this call on it; omitted, a source falls back to building synchronously as before.
     */
    all(waitUntil?: (promise: Promise<unknown>) => void): Promise<AppVehicleCollection>;
    /**
     * `all()` as the JSON the source already holds, sparing a parse and a re-serialize; null when
     * offline. Omitted where the source keeps no serialized build.
     */
    allSerialized?(waitUntil?: (promise: Promise<unknown>) => void): Promise<SerializedFleet | null>;
    /**
     * The vehicles serving the given trips, for departure boards; null once the source is too old to
     * serve positions. Omitted where reading the whole network is no dearer: answered from `all()`.
     * Takes the same `waitUntil` as `all()`, for sources that share its cached build.
     */
    forTrips?(tripIds: Set<string>, waitUntil?: (promise: Promise<unknown>) => void): Promise<AppVehicleCollection | null>;
    /** One vehicle, for a detail request. Omitted: looked up in `all()`. */
    find?(vehicleId: string, gtfsTripId?: string): Promise<SingleLiveVehicle>;
    /** Extra detail a network's own feed can add to a match already found. */
    augmentSingleLiveVehicle?(result: SingleLiveVehicle): Promise<SingleLiveVehicle>;
}
