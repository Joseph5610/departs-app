/** A neighbouring network's vehicles or stops, each tagged with its `city_slug` so opening one moves the selection there. */
export const tagCity = <T extends { features: { properties: object }[] }>(collection: T | null | undefined, city: string): T | null =>
    collection ? { ...collection, features: collection.features.map(f => ({ ...f, properties: { ...f.properties, city_slug: city } })) } : null;

/** The networks' collections as one; memoized on the collections themselves. */
export function concatCollections<T extends { features: unknown[] }>(...collections: Array<T | null>): T | null {
    const present = collections.filter((c): c is T => !!c && c.features.length > 0);
    if (present.length <= 1) return present[0] ?? null;
    return { ...present[0], features: present.flatMap(c => c.features) };
}
