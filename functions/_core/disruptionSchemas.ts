import * as z from 'zod/mini';
import { DISRUPTION_PROTOCOL } from '../../shared/alerts';
import { endpointSchema, subscriptionSchema } from './rideSchemas';

const keySchema = z.string().check(z.minLength(1), z.maxLength(100));
const lineSchema = z.object({
    name: z.string().check(z.minLength(1), z.maxLength(40)),
    keys: z.array(keySchema).check(z.minLength(1), z.maxLength(DISRUPTION_PROTOCOL.MAX_KEYS_PER_LINE)),
});
/** The city's home in the app (`paths.city`), opened from the notification. */
const cityPathSchema = z.string().check(z.maxLength(40), z.regex(/^\/[a-z0-9-]+$/));

/** Body of `POST /api/[city]/disruptions`: push new disruptions on these pinned lines to a subscription, or stop. */
export const disruptionPushRequestSchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('add'),
        subscription: subscriptionSchema,
        lines: z.array(lineSchema).check(z.minLength(1), z.maxLength(DISRUPTION_PROTOCOL.MAX_LINES)),
        title: z.string().check(z.minLength(1), z.maxLength(120)),
        path: cityPathSchema,
    }),
    z.object({
        action: z.literal('remove'),
        endpoint: endpointSchema,
    }),
]);
