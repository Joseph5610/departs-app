/** Which fleet vehicles one map view shows, as both the app and the server's `/vehicles` filters apply it. Plain TypeScript without imports. */

/** `[south, west, north, east]` */
export type Bounds = readonly [number, number, number, number];

export interface VehicleView {
    types: ReadonlySet<string> | null;
    names: ReadonlySet<string> | null;
    box: Bounds | null;
}

/** What a view reads of a vehicle. */
interface ViewedVehicle {
    geometry: { coordinates: readonly number[] } | null;
    properties: { route_type: string; route_short_name: string };
}

/** A view of route types, line names and bounds; null when it asks for nothing and shows the whole fleet. */
export function vehicleView(routeTypes: readonly string[] | null | undefined, lineNames: readonly string[] | null | undefined, box: Bounds | null): VehicleView | null {
    const types = routeTypes?.length ? new Set(routeTypes.map(r => r.toLowerCase())) : null;
    const names = lineNames?.length ? new Set(lineNames.map(r => r.toUpperCase())) : null;
    return types || names || box ? { types, names, box } : null;
}

/** Whether the view shows a vehicle; one without a position is shown only when the view has no bounds. */
export function isInView({ types, names, box }: VehicleView, { geometry, properties }: ViewedVehicle): boolean {
    if (types && !types.has(properties.route_type)) return false;
    if (names && !names.has(String(properties.route_short_name).toUpperCase())) return false;
    if (!box) return true;
    if (!geometry) return false;
    const [lng, lat] = geometry.coordinates;
    const [minLat, minLng, maxLat, maxLng] = box;
    return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}
