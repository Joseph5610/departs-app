import { z } from 'zod';

/**
 * Shape check only for the whole fleet: validating ~3,000 features per refresh costs more CPU than a
 * request has. `VehiclesMapper` type-checks every field it reads instead.
 */
export const golemioFleetSchema = z.object({
    features: z.array(z.unknown()).nullish(),
});
export type GolemioFleetPayload = z.infer<typeof golemioFleetSchema>;

/**
 * Shape check only for one trip's detail: `VehicleDetailMapper` type-checks every field it reads
 * instead. Confirms only that the response is an object at all - it may be a bare vehicle-properties
 * object or a FeatureCollection, and the mapper reads either shape.
 */
export const golemioVehicleDetailSchema = z.record(z.string(), z.unknown());
export type GolemioVehicleDetailPayload = z.infer<typeof golemioVehicleDetailSchema>;
