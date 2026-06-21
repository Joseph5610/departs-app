import { z } from 'zod';

export const golemioStopPropertiesSchema = z.object({
    stop_id: z.string(),
    stop_name: z.string(),
    location_type: z.number(),
    parent_station: z.string().nullable().optional(),
    platform_code: z.string().nullable().optional(),
    zone_id: z.string().nullable().optional(),
    wheelchair_boarding: z.number().optional(),
    level_id: z.string().nullable().optional(),
});
export type GolemioStopProperties = z.infer<typeof golemioStopPropertiesSchema>;

export const golemioStopFeatureSchema = z.object({
    type: z.literal('Feature'),
    geometry: z.object({
        type: z.literal('Point'),
        coordinates: z.tuple([z.number(), z.number()])
    }),
    properties: golemioStopPropertiesSchema
});
export type GolemioStopFeature = z.infer<typeof golemioStopFeatureSchema>;

export const golemioStopPayloadSchema = z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(golemioStopFeatureSchema.nullable().catch(err => {
        console.warn("Skipping invalid stop feature:", err.error.message);
        return null;
    }))
});
export type GolemioStopPayload = z.infer<typeof golemioStopPayloadSchema>;
