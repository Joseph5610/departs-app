import { z } from 'zod';

export const golemioVehicleDescriptorSchema = z.object({
    operator: z.string().nullable().optional(),
    vehicle_type: z.string().nullable().optional(),
    is_wheelchair_accessible: z.boolean().nullable().optional(),
    is_air_conditioned: z.boolean().nullable().optional(),
    has_usb_chargers: z.boolean().nullable().optional(),
    vehicle_registration_number: z.union([z.string(), z.number()]).nullable().optional(),
});
export type GolemioVehicleDescriptor = z.infer<typeof golemioVehicleDescriptorSchema>;

export const golemioVehiclePropertiesSchema = z.object({
    vehicle_id: z.union([z.string(), z.number()]).nullable().optional(),
    id: z.union([z.string(), z.number()]).nullable().optional(),
    gtfs_trip_id: z.string().nullable().optional(),
    route_short_name: z.string().nullable().optional(),
    gtfs_route_short_name: z.string().nullable().optional(),
    route_type: z.union([z.string(), z.number()]).nullable().optional(),
    trip_headsign: z.string().nullable().optional(),
    gtfs_trip_headsign: z.string().nullable().optional(),
    bearing: z.union([z.string(), z.number()]).nullable().optional(),
    delay: z.union([z.string(), z.number()]).nullable().optional(),
    state_position: z.string().nullable().optional(),
    next_stop_name: z.string().nullable().optional(),
    last_stop_sequence: z.union([z.string(), z.number()]).nullable().optional(),
    origin_timestamp: z.string().nullable().optional(),
    run_number: z.union([z.string(), z.number()]).nullable().optional(),
    vehicle_descriptor: golemioVehicleDescriptorSchema.optional(),
});
export type GolemioVehicleProperties = z.infer<typeof golemioVehiclePropertiesSchema>;

export const golemioVehicleFeatureSchema = z.object({
    type: z.literal('Feature'),
    geometry: z.object({
        type: z.literal('Point'),
        coordinates: z.tuple([z.number(), z.number()])
    }).nullable(),
    properties: golemioVehiclePropertiesSchema
});
export type GolemioVehicleFeature = z.infer<typeof golemioVehicleFeatureSchema>;

export const golemioStopTimePropertiesSchema = z.object({
    stop_id: z.union([z.string(), z.number()]).nullable().optional(),
    stop_name: z.string().nullable().optional(),
    stop_sequence: z.number().nullable().optional(),
    arrival_time: z.string().nullable().optional(),
    departure_time: z.string().nullable().optional(),
    realtime_arrival_time: z.string().nullable().optional(),
    realtime_departure_time: z.string().nullable().optional(),
    zone_id: z.string().nullable().optional(),
    is_wheelchair_accessible: z.boolean().nullable().optional(),
    shape_dist_traveled: z.number().nullable().optional(),
});
export type GolemioStopTimeProperties = z.infer<typeof golemioStopTimePropertiesSchema>;

export const golemioStopTimeFeatureSchema = z.object({
    type: z.literal('Feature'),
    geometry: z.object({
        type: z.string(),
        coordinates: z.union([z.array(z.number()), z.array(z.array(z.number()))])
    }).nullable().optional(),
    properties: golemioStopTimePropertiesSchema
});
export type GolemioStopTimeFeature = z.infer<typeof golemioStopTimeFeatureSchema>;

export const golemioShapeFeatureSchema = z.object({
    type: z.literal('Feature'),
    geometry: z.object({
        type: z.literal('Point'),
        coordinates: z.tuple([z.number(), z.number()])
    }),
    properties: z.object({
        shape_dist_traveled: z.number()
    })
});
export type GolemioShapeFeature = z.infer<typeof golemioShapeFeatureSchema>;

export const golemioVehiclePayloadSchema = golemioVehiclePropertiesSchema.partial().extend({
    type: z.string().optional(),
    features: z.array(golemioVehicleFeatureSchema.nullable().catch(err => {
        console.warn("Skipping invalid vehicle feature:", err.error);
        return null;
    })).optional(),
    geometry: z.object({ type: z.literal('Point'), coordinates: z.tuple([z.number(), z.number()]) }).nullable().optional(),
    stop_times: z.object({ 
        features: z.array(golemioStopTimeFeatureSchema.nullable().catch(err => {
            console.warn("Skipping invalid stop time feature:", err.error);
            return null;
        })) 
    }).optional(),
    shapes: z.union([
        z.array(golemioShapeFeatureSchema),
        z.object({ features: z.array(golemioShapeFeatureSchema) })
    ]).optional(),
    vehicle_descriptor: golemioVehicleDescriptorSchema.nullable().optional(),
    last_stop_sequence: z.union([z.string(), z.number()]).nullable().optional(),
    origin_timestamp: z.string().nullable().optional(),
    next_stop_name: z.string().nullable().optional(),
});
export type GolemioVehiclePayload = z.infer<typeof golemioVehiclePayloadSchema>;
