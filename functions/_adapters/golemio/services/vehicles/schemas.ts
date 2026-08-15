import { z } from 'zod';
const golemioVehicleDescriptorSchema = z.object({
    operator: z.string().nullish().transform(v => v ?? undefined),
    vehicle_type: z.string().nullish().transform(v => v ?? undefined),
    is_wheelchair_accessible: z.boolean().nullish().transform(v => v ?? undefined),
    is_air_conditioned: z.boolean().nullish().transform(v => v ?? undefined),
    has_usb_chargers: z.boolean().nullish().transform(v => v ?? undefined),
    vehicle_registration_number: z.union([z.string(), z.number()]).nullish().transform(v => v != null ? String(v) : undefined),
});


const golemioVehiclePropertiesSchema = z.object({
    vehicle_id: z.union([z.string(), z.number()]).nullish().transform(v => v != null ? String(v) : undefined),
    id: z.union([z.string(), z.number()]).nullish().transform(v => v != null ? String(v) : undefined),
    gtfs_trip_id: z.string().nullish().transform(v => v ?? undefined),
    route_short_name: z.string().nullish().transform(v => v ?? undefined),
    gtfs_route_short_name: z.string().nullish().transform(v => v ?? undefined),
    route_type: z.union([z.string(), z.number()]).nullish().transform(v => v != null ? String(v) : undefined),
    trip_headsign: z.string().nullish().transform(v => v ?? undefined),
    gtfs_trip_headsign: z.string().nullish().transform(v => v ?? undefined),
    bearing: z.union([z.string(), z.number()]).nullish().transform(v => v != null ? Number(v) : undefined),
    delay: z.union([z.string(), z.number()]).nullish().transform(v => v != null ? Number(v) : null),
    state_position: z.string().nullish().transform(v => v ?? 'unknown'),
    last_stop_sequence: z.union([z.string(), z.number()]).nullish().transform(v => v != null ? Number(v) : 0),
    origin_timestamp: z.string().nullish().transform(v => v ?? undefined),
    run_number: z.union([z.string(), z.number()]).nullish().transform(v => v != null ? String(v) : undefined),
    shape_dist_traveled: z.number().nullish().transform(v => v ?? undefined),
    vehicle_descriptor: golemioVehicleDescriptorSchema.nullish().transform(v => v ?? undefined),
});


const golemioVehicleFeatureSchema = z.object({
    type: z.literal('Feature'),
    geometry: z.object({
        type: z.literal('Point'),
        coordinates: z.tuple([z.number(), z.number()])
    }).nullable(),
    properties: golemioVehiclePropertiesSchema
});
export type GolemioVehicleFeature = z.infer<typeof golemioVehicleFeatureSchema>;

const golemioStopTimePropertiesSchema = z.object({
    stop_id: z.union([z.string(), z.number()]).nullish().transform(v => v != null ? String(v) : undefined),
    stop_name: z.string().nullish().transform(v => v ?? undefined),
    stop_sequence: z.number().nullish().transform(v => v ?? undefined),
    arrival_time: z.string().nullish().transform(v => v ?? undefined),
    departure_time: z.string().nullish().transform(v => v ?? undefined),
    realtime_arrival_time: z.string().nullish().transform(v => v ?? undefined),
    realtime_departure_time: z.string().nullish().transform(v => v ?? undefined),
    zone_id: z.string().nullish().transform(v => v ?? undefined),
    is_wheelchair_accessible: z.boolean().nullish().transform(v => v ?? undefined),
    shape_dist_traveled: z.number().nullish().transform(v => v ?? undefined),
});


const golemioStopTimeFeatureSchema = z.object({
    type: z.literal('Feature'),
    geometry: z.object({
        type: z.string(),
        coordinates: z.union([z.array(z.number()), z.array(z.array(z.number()))])
    }).nullish().transform(v => v ?? undefined),
    properties: golemioStopTimePropertiesSchema
});
export type GolemioStopTimeFeature = z.infer<typeof golemioStopTimeFeatureSchema>;

const golemioShapeFeatureSchema = z.object({
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
        console.warn("Skipping invalid vehicle feature:", err);
        return null;
    })).nullish().transform(arr => arr ? arr.filter((f): f is GolemioVehicleFeature => f !== null) : undefined),
    geometry: z.object({ type: z.literal('Point'), coordinates: z.tuple([z.number(), z.number()]) }).nullish().transform(v => v ?? undefined),
    stop_times: z.object({ 
        features: z.array(golemioStopTimeFeatureSchema.nullable().catch(err => {
            console.warn("Skipping invalid stop time feature:", err);
            return null;
        })).transform(arr => arr.filter((f): f is GolemioStopTimeFeature => f !== null))
    }).nullish().transform(v => v ?? undefined),
    shapes: z.union([
        z.array(golemioShapeFeatureSchema),
        z.object({ features: z.array(golemioShapeFeatureSchema) })
    ]).optional(),
    vehicle_descriptor: golemioVehicleDescriptorSchema.nullish().transform(v => v ?? undefined),
    last_stop_sequence: z.union([z.string(), z.number()]).nullish().transform(v => v != null ? Number(v) : 0),
    origin_timestamp: z.string().nullish().transform(v => v ?? undefined),
});
export type GolemioVehiclePayload = z.infer<typeof golemioVehiclePayloadSchema>;
