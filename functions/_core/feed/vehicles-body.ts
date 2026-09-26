import type { AppVehicleCollection } from '../types';
import { feedStatusAt } from './freshness';

/** The unfiltered vehicles answer as JSON, and whether it is the offline one (which the edge must not hold). */
export interface VehiclesBody {
    body: string;
    offline: boolean;
}

/** Each collection serialized without `status`, once: the map polls the same collection every few seconds. */
const serialized = new WeakMap<AppVehicleCollection, string>();

/**
 * The map's unfiltered vehicles answer for a city's current collection, with the status its age earns
 * stamped on - the serialized counterpart of `withFeedAge`, which decides the status the same way.
 * `collection` must be the source's own shared object, not a per-request copy, or nothing is reused.
 */
export function vehiclesBody(collection: AppVehicleCollection, readAt?: number): VehiclesBody {
    if (collection.status === 'upstream_offline') return offlineBody(collection.last_updated);
    let json = serialized.get(collection);
    if (json === undefined) {
        json = JSON.stringify({ ...collection, status: undefined });
        serialized.set(collection, json);
    }
    return vehiclesBodyFromJson(json, readAt ?? (collection.last_updated ? Date.parse(collection.last_updated) : NaN), collection.last_updated);
}

/** `vehiclesBody` for a collection the source already holds serialized without `status`, sparing a parse and a re-serialize. */
export function vehiclesBodyFromJson(json: string, updatedMs: number, lastUpdated?: string): VehiclesBody {
    const status = feedStatusAt(updatedMs);
    if (status === 'upstream_offline') return offlineBody(lastUpdated);
    // `json` is a serialized object without `status`, so the key is appended before its closing brace.
    return { body: `${json.slice(0, -1)},"status":"${status}"}`, offline: false };
}

function offlineBody(lastUpdated?: string): VehiclesBody {
    const offline: AppVehicleCollection = { type: 'FeatureCollection', features: [], status: 'upstream_offline', last_updated: lastUpdated };
    return { body: JSON.stringify(offline), offline: true };
}
