/**
 * Typed reads over an object zod has only shape-checked (or not checked at all), shared by
 * `VehiclesMapper` (the fleet, ~3,000 features per refresh) and `VehicleDetailMapper` (one trip):
 * validating every field of every feature costs more CPU than either endpoint's budget allows, so the
 * envelope is checked and every field is read defensively here instead.
 */

export type Fields = Record<string, unknown>;

export const isFields = (v: unknown): v is Fields => typeof v === 'object' && v !== null && !Array.isArray(v);
export const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
export const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
export const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
export const strOrNum = (v: unknown): string | number | undefined => (typeof v === 'string' || typeof v === 'number' ? v : undefined);

/** A GeoJSON Point, read field-by-field; anything else (wrong type, missing coordinate) is null. */
export function readPoint(v: unknown): { type: 'Point'; coordinates: [number, number] } | null {
    if (!isFields(v) || v.type !== 'Point' || !Array.isArray(v.coordinates) || v.coordinates.length !== 2) return null;
    const [lon, lat] = v.coordinates as unknown[];
    return typeof lon === 'number' && typeof lat === 'number' ? { type: 'Point', coordinates: [lon, lat] } : null;
}
