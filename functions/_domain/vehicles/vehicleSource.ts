import type { AppVehicleCollection, AppVehicleFeature } from '../../_core/types';

/** A live-vehicle result, as `VehiclesService.getSingleLiveVehicle` returns it. */
export interface SingleLiveVehicle {
    liveMatch?: AppVehicleFeature;
    lastStopId?: string;
    /** The licence plate, where the network has one apart from `vehicle_id`; shown only on a detail. */
    registrationNumber?: string;
}

/** A network's whole fleet as built from its feed, and what the fleet cache keeps with it. */
export interface FleetBuild {
    collection: AppVehicleCollection;
    /** The feed publication's ETag, so the next build can ask whether it changed. */
    feedEtag?: string;
    /** Licence plates by `vehicle_id`, where the network has them apart from it; read only by a detail. */
    plates?: Record<string, string>;
}

/**
 * What a network supplies: a GTFS-RT feed, Prešov's CSV export, DÚK's Portabo feed. `EdgeFleetSource`
 * caches its build for every isolate and answers the map, details and boards from it.
 */
export interface NetworkVehicles {
    /** The whole fleet; `'unchanged'` while the feed is still the publication `storedEtag` names; null when unreadable. */
    buildFleet(storedEtag?: string): Promise<FleetBuild | 'unchanged' | null>;
    /** Whether a fleet's age counts from when it was built rather than its `last_updated`: the feed's own stamps lag (Golemio). */
    readonly agedFromBuild?: boolean;
    /** Extra detail a network's own feed can add to a match already found. */
    augmentSingleLiveVehicle?(result: SingleLiveVehicle): Promise<SingleLiveVehicle>;
}
