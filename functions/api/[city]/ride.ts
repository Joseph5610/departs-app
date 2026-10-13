import { createErrorResponse, createSuccessResponse } from "../../_core/apiUtils";
import { ridePushRequestSchema } from "../../_core/rideSchemas";
import type { Env } from "../../_core/types";
import { getCity } from "../../_cities";
import type { RideWatchRequest } from "../../_workers/RideWatch";

/** Starts or stops ride-mode push for one subscription, in the trip's `RideWatch` Durable Object. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
    const slug = String(params.city);
    if (!getCity(slug)) return createErrorResponse('City not found', 404);
    if (!env.RIDE_WATCH) return createErrorResponse('Ride push is not available.', 503);

    const parsed = ridePushRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return createErrorResponse('Invalid payload.', 400);
    const body = parsed.data;

    const command: RideWatchRequest = body.action === 'add'
        ? { action: 'add', trip: { city: slug, tripId: body.tripId, vehicleId: body.vehicleId }, rider: { subscription: body.subscription, exitSequence: body.exitSequence, texts: body.texts } }
        : { action: 'remove', endpoint: body.endpoint, exitSequence: body.exitSequence };
    // Keyed by vehicle too, so one request can't point other riders of the trip at a different vehicle.
    const stub = env.RIDE_WATCH.get(env.RIDE_WATCH.idFromName(`${slug}:${body.tripId}:${body.vehicleId ?? ''}`));
    const response = await stub.fetch('https://ride.internal/', { method: 'POST', body: JSON.stringify(command) });
    if (response.status === 429) return createErrorResponse('Too many riders on this trip.', 429);
    return response.ok ? createSuccessResponse({ ok: true }, 0) : createErrorResponse('Ride push failed.', 502);
};
