/**
 * Typed reads over an object zod has only shape-checked (or not checked at all), for upstream lists
 * too large to validate field by field within a request's CPU budget (Golemio's fleet, Portabo's
 * traffic): the envelope is checked and every field is read defensively here instead.
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
