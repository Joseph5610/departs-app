import { z } from 'zod';

/**
 * Zod schemas for validating incoming URL query parameters.
 */

// Sanitizer function to prevent path traversal
const sanitizeId = (id: string) => id.replace(/[^a-zA-Z0-9_,-]/g, '');

// Helper to coerce a single string or an array of strings into an array
const arrayParam = z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .transform(arr => arr.map(sanitizeId).filter(id => id.length > 0))
    .default([]);

export const vehicleQuerySchema = z.object({
    bounds: z.string().optional().nullable(),
    routeType: arrayParam,
    routeShortName: arrayParam,
});

export const vehicleDetailQuerySchema = z.object({
    vehicleId: z.string().optional().nullable().transform(val => val ? sanitizeId(val) : null),
    tripId: z.string().transform(sanitizeId).refine(val => val.length > 0, "Valid tripId is required"),
});

export const departuresQuerySchema = z.object({
    stopId: arrayParam,
});

/**
 * Safely converts URLSearchParams to a plain object handling duplicate keys
 * as arrays, and parses it with the provided Zod schema.
 */
export function parseSearchParams<T extends z.ZodTypeAny>(
    searchParams: URLSearchParams,
    schema: T
): z.infer<T> {
    const obj: Record<string, string | string[]> = {};
    for (const key of searchParams.keys()) {
        const values = searchParams.getAll(key);
        // If there's only one value, keep it as a string.
        // The arrayParam Zod helper will transform it to an array if needed.
        obj[key] = values.length === 1 ? values[0] : values;
    }
    return schema.parse(obj);
}
