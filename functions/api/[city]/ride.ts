import { createErrorResponse, forwardToWatch, readJsonBody } from "../../_core/apiUtils";
import { ridePushRequestSchema } from "../../_core/rideSchemas";
import type { Env } from "../../_core/types";
import { isDeviceKey } from "../../_core/push/webPush";
import { getCity } from "../../_cities";
import type { RideWatchRequest } from "../../_domain/rides/watchRun";
import { RIDE_PUSH } from "../../_core/config";
import { TRIP_RULES } from "../../../shared/rides";

/** Starts or stops ride-mode push for one subscription, in the trip's `RideWatch` Durable Object. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
    const slug = String(params.city);
    if (!getCity(slug)) return createErrorResponse('City not found', 404);
    if (!env.RIDE_WATCH) return createErrorResponse('Ride push is not available.', 503);

    const json = await readJsonBody(request, RIDE_PUSH.MAX_BODY_BYTES);
    if (json instanceof Response) return json;
    const parsed = ridePushRequestSchema.safeParse(json);
    if (!parsed.success) return createErrorResponse('Invalid payload.', 400);
    const body = parsed.data;
    if (body.action === 'add' && !(await isDeviceKey(body.subscription.keys.p256dh))) return createErrorResponse('Invalid payload.', 400);

    if (body.action === 'add') {
        const board = body.board ?? null;
        // Nothing to alert, or a boarding stop not within the hours ahead the timetable comparison covers.
        if (body.exitSequence === null && board?.leadMin == null) return createErrorResponse('Nothing to alert.', 400);
        if (board && (board.scheduledMs < Date.now() - RIDE_PUSH.MAX_AGE_MS || board.scheduledMs > Date.now() + TRIP_RULES.TIMETABLE_AHEAD_MS)) {
            return createErrorResponse('Departure is out of range.', 400);
        }
    }

    const command: RideWatchRequest = body.action === 'add'
        ? {
            action: 'add',
            trip: { city: slug, tripId: body.tripId },
            rider: {
                subscription: body.subscription,
                exitSequence: body.exitSequence,
                board: body.board ?? null,
                texts: body.texts,
                navigate: new URL(body.path, request.url).href,
            },
        }
        : { action: 'remove', endpoint: body.endpoint };
    // One watch per trip, whatever vehicle a device knew: it finds the vehicle itself, so every rider reads the same detail.
    return forwardToWatch(env.RIDE_WATCH, `${slug}:${body.tripId}`, command, { refused: 'Too many riders on this trip.', failed: 'Ride push failed.' });
};
