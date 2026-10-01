import * as z from 'zod/mini';
import { API_LIMITS } from './config';

/**
 * Zod schemas for validating incoming URL query parameters.
 */

// Sanitizer function to prevent path traversal
const sanitizeId = (id: string) => id.replace(/[^a-zA-Z0-9_,-]/g, '');

// Helper to coerce a single string or an array of strings into an array
const arrayParam = () => z._default(
    z.pipe(
        z.pipe(z.union([z.string(), z.array(z.string())]), z.transform((val) => (Array.isArray(val) ? val : [val]))),
        z.transform(arr => arr.map(sanitizeId).filter(id => id.length > 0)),
    ),
    [],
);

/** `south,west,north,east` — NOT the lon-first order `CityConfig.bounds` stores. */
const isValidBounds = (value: string): boolean => {
    const parts = value.split(',');
    return parts.length === 4 && parts.every(part => part.trim() !== '' && Number.isFinite(Number(part)));
};

/** Splits an already-validated `bounds` param into `[south, west, north, east]`. */
export function parseBoundsParam(bounds: string): [number, number, number, number] {
    const [south, west, north, east] = bounds.split(',').map(Number);
    return [south, west, north, east];
}

export const vehicleQuerySchema = z.lazy(() => z.object({
    bounds: z.nullable(z.optional(
        z.string().check(z.refine(isValidBounds, 'bounds must be four comma-separated numbers: south,west,north,east')),
    )),
    routeType: arrayParam(),
    routeShortName: arrayParam(),
}));

export const vehicleDetailQuerySchema = z.lazy(() => z.object({
    vehicleId: z.pipe(z.nullable(z.optional(z.string())), z.transform(val => val ? sanitizeId(val) : null)),
    tripId: z.pipe(z.string(), z.transform(sanitizeId)).check(z.refine(val => val.length > 0, "Valid tripId is required")),
}));

export const departuresQuerySchema = z.lazy(() => z.object({
    stopId: arrayParam().check(z.refine(
        ids => ids.length <= API_LIMITS.DEPARTURE_STOP_IDS,
        `A departures request may name at most ${API_LIMITS.DEPARTURE_STOP_IDS} stops.`
    )),
}));

/**
 * Safely converts URLSearchParams to a plain object handling duplicate keys
 * as arrays, and parses it with the provided Zod schema.
 */
export function parseSearchParams<T extends z.ZodMiniType>(
    searchParams: URLSearchParams,
    schema: T
): z.output<T> {
    const obj: Record<string, string | string[]> = {};
    for (const key of searchParams.keys()) {
        const values = searchParams.getAll(key);
        // If there's only one value, keep it as a string.
        // The arrayParam Zod helper will transform it to an array if needed.
        obj[key] = values.length === 1 ? values[0] : values;
    }
    return schema.parse(obj);
}
