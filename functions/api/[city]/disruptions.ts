import { createErrorResponse, forwardToWatch, readJsonBody } from "../../_core/apiUtils";
import { disruptionPushRequestSchema } from "../../_core/disruptionSchemas";
import type { Env } from "../../_core/types";
import { isDeviceKey } from "../../_core/push/webPush";
import { getCity, getCityConfig } from "../../_cities";
import type { DisruptionWatchRequest } from "../../_domain/disruptions/watchRun";
import { DISRUPTION_PUSH } from "../../_core/config";

/** Starts, updates or stops pushes of new disruptions on a device's pinned lines, in the city's `DisruptionWatch` Durable Object. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
    const slug = String(params.city);
    if (!getCity(slug) || !getCityConfig(slug)?.hasAlerts) return createErrorResponse('City not found', 404);
    if (!env.DISRUPTION_WATCH) return createErrorResponse('Disruption push is not available.', 503);

    const json = await readJsonBody(request, DISRUPTION_PUSH.MAX_BODY_BYTES);
    if (json instanceof Response) return json;
    const parsed = disruptionPushRequestSchema.safeParse(json);
    if (!parsed.success) return createErrorResponse('Invalid payload.', 400);
    const body = parsed.data;
    if (body.action === 'add' && !(await isDeviceKey(body.subscription.keys.p256dh))) return createErrorResponse('Invalid payload.', 400);

    const command: DisruptionWatchRequest = body.action === 'add'
        ? {
            action: 'add',
            city: slug,
            ip: request.headers.get('CF-Connecting-IP'),
            subscriber: { subscription: body.subscription, lines: body.lines, title: body.title, navigate: new URL(body.path, request.url).href },
        }
        : { action: 'remove', endpoint: body.endpoint };
    return forwardToWatch(env.DISRUPTION_WATCH, slug, command, { refused: 'Too many subscriptions.', failed: 'Disruption push failed.' });
};
