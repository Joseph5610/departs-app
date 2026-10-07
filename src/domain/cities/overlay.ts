import type { StopCollection, VehicleCollection } from '@/types';
import { withStopColor } from '@/domain/stops/twins';

/** A neighbouring network's vehicles, each tagged with its `city_slug` so opening one moves the selection there. */
export const tagVehicles = (collection: VehicleCollection | null | undefined, city: string): VehicleCollection | null =>
    collection ? { ...collection, features: collection.features.map(f => ({ ...f, properties: { ...f.properties, city_slug: city } })) } : null;

/** A neighbouring network's stops, tagged with its `city_slug` and drawn in its own stop colour. */
export const tagStops = (collection: StopCollection | null, city: string, stopColor: string | undefined): StopCollection | null =>
    collection
        ? withStopColor({ ...collection, features: collection.features.map(f => ({ ...f, properties: { ...f.properties, city_slug: city } })) }, stopColor)
        : null;

/** The networks' collections as one; memoized on the collections themselves. */
export function concatCollections<T extends { features: unknown[] }>(...collections: Array<T | null>): T | null {
    const present = collections.filter((c): c is T => !!c && c.features.length > 0);
    if (present.length <= 1) return present[0] ?? null;
    return { ...present[0], features: present.flatMap(c => c.features) };
}
