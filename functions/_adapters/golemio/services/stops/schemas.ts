import { z } from 'zod';

const golemioStopPropertiesSchema = z.object({
    stop_id: z.string(),
    stop_name: z.string().nullable(),
    location_type: z.number(),
    parent_station: z.string().nullable().optional(),
    platform_code: z.string().nullable().optional(),
    zone_id: z.string().nullable().optional(),
    wheelchair_boarding: z.number().nullable().optional(),
    level_id: z.string().nullable().optional(),
});


const golemioStopFeatureSchema = z.object({
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
    features: z.array(golemioStopFeatureSchema.nullable())
});

