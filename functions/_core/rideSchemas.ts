import * as z from 'zod/mini';
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

/** Body of `POST /api/[city]/ride`: start watching a ride for a push subscription, or stop. */
export const ridePushRequestSchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('add'),
        tripId: idSchema,
        vehicleId: z.nullable(idSchema),
        exitSequence: z.number().check(z.int(), z.nonnegative(), z.maximum(10_000)),
        subscription: z.object({
            endpoint: endpointSchema,
            // A P-256 point (65 bytes) and a 16-byte secret, base64url.
            keys: z.object({ p256dh: z.string().check(z.regex(/^[A-Za-z0-9_-]{87}={0,1}$/)), auth: z.string().check(z.regex(/^[A-Za-z0-9_-]{22}(==)?$/)) }),
        }),
        texts: z.object({ next: textSchema, arrived: textSchema }),
    }),
    z.object({ action: z.literal('remove'), tripId: idSchema, vehicleId: z.nullable(idSchema), exitSequence: z.number(), endpoint: endpointSchema }),
]);
