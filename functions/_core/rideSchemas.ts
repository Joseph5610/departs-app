import * as z from 'zod/mini';
import { RIDE_PROTOCOL } from '../../shared/rides';
import { PUSH_SERVICE_HOSTS } from './config';

const isPushEndpoint = (value: string): boolean => {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && PUSH_SERVICE_HOSTS.some(host => host.test(url.hostname));
    } catch {
        return false;
    }
};

const endpointSchema = z.string().check(z.maxLength(1024), z.refine(isPushEndpoint));
const textSchema = z.object({ title: z.string().check(z.maxLength(120)), body: z.string().check(z.maxLength(200)) });
const idSchema = z.string().check(z.minLength(1), z.maxLength(200));
const subscriptionSchema = z.object({
    endpoint: endpointSchema,
    // A P-256 point (65 bytes) and a 16-byte secret, base64url.
    keys: z.object({ p256dh: z.string().check(z.regex(/^[A-Za-z0-9_-]{87}={0,1}$/)), auth: z.string().check(z.regex(/^[A-Za-z0-9_-]{22}(==)?$/)) }),
});
/** A trip's page in the app (`paths.trip`), opened from the notification. */
const tripPathSchema = z.string().check(z.maxLength(400), z.regex(/^\/[a-z0-9-]+\/trip\/[A-Za-z0-9%._~-]+(\/[A-Za-z0-9%._~-]+)?$/));
const sequenceSchema = z.number().check(z.int(), z.nonnegative(), z.maximum(10_000));

const boardSchema = z.object({
    sequence: sequenceSchema,
    /** Timetable departure from the boarding stop, epoch ms. */
    scheduledMs: z.number().check(z.int(), z.positive()),
    leadMin: z.nullable(z.number().check(z.int(), z.minimum(1), z.maximum(RIDE_PROTOCOL.MAX_LEAD_MIN))),
});

/**
 * Body of `POST /api/[city]/ride`: watch a trip for a push subscription (an alert before its exit and/or before it
 * leaves the rider's stop), or stop. An app predating My trip sends an exit only, with `next`/`arrived` texts.
 */
export const ridePushRequestSchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('add'),
        tripId: idSchema,
        exitSequence: z.nullable(sequenceSchema),
        board: z.optional(z.nullable(boardSchema)),
        subscription: subscriptionSchema,
        texts: z.object({ next: z.optional(textSchema), arrived: z.optional(textSchema), soon: z.optional(textSchema), cancelled: z.optional(textSchema) }),
        path: tripPathSchema,
    }),
    z.object({
        action: z.literal('remove'),
        tripId: idSchema,
        endpoint: endpointSchema,
    }),
]);
