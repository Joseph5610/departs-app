import { createErrorResponse, createSuccessResponse } from "../../_core/apiUtils";
import { ridePushRequestSchema } from "../../_core/rideSchemas";
import type { Env } from "../../_core/types";
import { getCity } from "../../_cities";
import type { RideWatchRequest } from "../../_workers/RideWatch";
import { RIDE_PUSH } from "../../_core/config";

const parseJson = (raw: string): unknown => {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

/** Starts or stops ride-mode push for one subscription, in the trip's `RideWatch` Durable Object. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
    const slug = String(params.city);
    if (!getCity(slug)) return createErrorResponse('City not found', 404);
    if (!env.RIDE_WATCH) return createErrorResponse('Ride push is not available.', 503);

    if (Number(request.headers.get('Content-Length') ?? 0) > RIDE_PUSH.MAX_BODY_BYTES) return createErrorResponse('Payload too large.', 413);
    const raw = await request.text();
    if (raw.length > RIDE_PUSH.MAX_BODY_BYTES) return createErrorResponse('Payload too large.', 413);
    const parsed = ridePushRequestSchema.safeParse(parseJson(raw));
    if (!parsed.success) return createErrorResponse('Invalid payload.', 400);
    const body = parsed.data;

    const command: RideWatchRequest = body.action === 'add'
        ? { action: 'add', trip: { city: slug, tripId: body.tripId, vehicleId: body.vehicleId }, rider: { subscription: body.subscription, exitSequence: body.exitSequence, texts: body.texts, navigate: new URL(body.path, request.url).href } }
        : { action: 'remove', endpoint: body.endpoint, exitSequence: body.exitSequence };
    // Keyed by vehicle too, so one request can't point other riders of the trip at a different vehicle.
    const stub = env.RIDE_WATCH.get(env.RIDE_WATCH.idFromName(`${slug}:${body.tripId}:${body.vehicleId ?? ''}`));
    const response = await stub.fetch('https://ride.internal/', { method: 'POST', body: JSON.stringify(command) });
    if (response.status === 429) return createErrorResponse('Too many riders on this trip.', 429);
    return response.ok ? createSuccessResponse({ ok: true }, 0) : createErrorResponse('Ride push failed.', 502);
};
