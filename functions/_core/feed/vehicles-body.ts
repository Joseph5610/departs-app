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
    const updatedMs = readAt ?? (collection.last_updated ? Date.parse(collection.last_updated) : NaN);
    const status = collection.status === 'upstream_offline' ? 'upstream_offline' : feedStatusAt(updatedMs);

    if (status === 'upstream_offline') {
        const offline: AppVehicleCollection = { type: 'FeatureCollection', features: [], status, last_updated: collection.last_updated };
        return { body: JSON.stringify(offline), offline: true };
    }

    let json = serialized.get(collection);
    if (json === undefined) {
        json = JSON.stringify({ ...collection, status: undefined });
        serialized.set(collection, json);
    }
    // `json` is a serialized object without `status`, so the key is appended before its closing brace.
    return { body: `${json.slice(0, -1)},"status":"${status}"}`, offline: false };
}
