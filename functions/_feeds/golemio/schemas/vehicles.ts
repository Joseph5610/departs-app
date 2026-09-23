import { z } from 'zod';
const golemioVehicleDescriptorSchema = z.object({
    operator: z.string().nullish(),
    vehicle_type: z.string().nullish(),
    is_wheelchair_accessible: z.boolean().nullish(),
    is_air_conditioned: z.boolean().nullish(),
    has_usb_chargers: z.boolean().nullish(),
    vehicle_registration_number: z.coerce.string().nullish(),
});


const golemioVehiclePropertiesSchema = z.object({
    vehicle_id: z.union([z.string(), z.number()]).nullish(),
    id: z.union([z.string(), z.number()]).nullish(),
    gtfs_trip_id: z.string().nullish(),
    route_short_name: z.string().nullish(),
    gtfs_route_short_name: z.string().nullish(),
    route_type: z.union([z.string(), z.number()]).nullish(),
    trip_headsign: z.string().nullish(),
    gtfs_trip_headsign: z.string().nullish(),
    bearing: z.number().nullish(),
    delay: z.number().nullish(),
    state_position: z.string().nullish(),
    last_stop_sequence: z.number().nullish(),
    origin_timestamp: z.string().nullish(),
    run_number: z.union([z.string(), z.number()]).nullish(),
    shape_dist_traveled: z.number().nullish(),
    vehicle_descriptor: golemioVehicleDescriptorSchema.nullish(),
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
    stop_id: z.coerce.string().nullish(),
    stop_name: z.string().nullish(),
    stop_sequence: z.number().nullish(),
    arrival_time: z.string().nullish(),
    departure_time: z.string().nullish(),
    realtime_arrival_time: z.string().nullish(),
    realtime_departure_time: z.string().nullish(),
    zone_id: z.string().nullish(),
    is_wheelchair_accessible: z.boolean().nullish(),
    shape_dist_traveled: z.number().nullish(),
});


const golemioStopTimeFeatureSchema = z.object({
    type: z.literal('Feature'),
    geometry: z.object({
        type: z.string(),
        coordinates: z.union([z.array(z.number()), z.array(z.array(z.number()))])
    }).nullish(),
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
    features: z.array(golemioVehicleFeatureSchema.nullable()).nullish(),
    geometry: z.object({ type: z.literal('Point'), coordinates: z.tuple([z.number(), z.number()]) }).nullish(),
    stop_times: z.object({ 
        features: z.array(golemioStopTimeFeatureSchema.nullable())
    }).nullish(),
    shapes: z.union([
        z.array(golemioShapeFeatureSchema),
        z.object({ features: z.array(golemioShapeFeatureSchema) })
    ]).optional(),
    vehicle_descriptor: golemioVehicleDescriptorSchema.nullish(),
    last_stop_sequence: z.coerce.number().nullish(),
    origin_timestamp: z.string().nullish(),
});
export type GolemioVehiclePayload = z.infer<typeof golemioVehiclePayloadSchema>;

/**
 * Shape check only for the whole fleet: validating ~3,000 features per refresh costs more CPU than a
 * request has. `VehiclesMapper` type-checks every field it reads instead.
 */
export const golemioFleetSchema = z.object({
    features: z.array(z.unknown()).nullish(),
});
export type GolemioFleetPayload = z.infer<typeof golemioFleetSchema>;

/**
 * Shape check only for one trip's detail: it embeds a full route shape (a trip's geometry, easily
 * hundreds of points) and stop times, and validating those per-field through `golemioVehiclePayloadSchema`
 * costs the same per-item CPU the fleet schema above was built to avoid. `VehicleDetailMapper`
 * type-checks every field it reads instead. Confirms only that the response is an object at all - it
 * may be a bare vehicle-properties object or a FeatureCollection, and the mapper reads either shape.
 */
export const golemioVehicleDetailSchema = z.record(z.string(), z.unknown());
export type GolemioVehicleDetailPayload = z.infer<typeof golemioVehicleDetailSchema>;
