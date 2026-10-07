import * as z from 'zod/mini';
import { API_LIMITS } from './config';

/**
 * Zod schemas for the feedback endpoint body and the entries it stores in KV.
 * Unknown keys are stripped, so a diagnostics field the client starts sending must be added here too.
 */

const diagnosticDataSchema = z.lazy(() => z.object({
    url: z.string(),
    userAgent: z.string(),
    appVersion: z.string(),
    windowSize: z.optional(z.object({ width: z.number(), height: z.number() })),
    connectionType: z.optional(z.string()),
    sessionDurationSec: z.optional(z.number()),
    devicePixelRatio: z.optional(z.number()),
    hardwareConcurrency: z.optional(z.number()),
    deviceMemory: z.optional(z.number()),
    timezone: z.optional(z.string()),
    activeLayers: z.optional(z.array(z.string())),
    selectedVehicleId: z.optional(z.string()),
    selectedStopId: z.optional(z.string()),
    isFollowing: z.optional(z.boolean()),
    selectedCity: z.optional(z.string()),
    showVehicles: z.optional(z.boolean()),
    showStops: z.optional(z.boolean()),
    mapBaseStyle: z.optional(z.string()),
    theme: z.optional(z.string()),
    locale: z.optional(z.string()),
    isPwa: z.optional(z.boolean()),
    gpsEnabled: z.optional(z.boolean()),
    crashInfo: z.optional(z.object({
        errorName: z.string(),
        errorMessage: z.string(),
        errorStack: z.optional(z.string()),
        componentStack: z.optional(z.string()),
    })),
}));

const feedbackPayloadObject = () => z.object({
    type: z.enum(['bug', 'feature_request', 'other', 'crash']),
    message: z.string().check(z.minLength(API_LIMITS.FEEDBACK_MESSAGE_MIN_CHARS), z.maxLength(API_LIMITS.FEEDBACK_MESSAGE_MAX_CHARS)),
    email: z.union([z.optional(z.string().check(z.email())), z.literal('')]),
    includeDiagnostics: z.boolean(),
    diagnostics: z.optional(diagnosticDataSchema),
    turnstileToken: z.string().check(z.minLength(1)),
});

export const feedbackPayloadSchema = z.lazy(feedbackPayloadObject);

export const storedFeedbackSchema = z.lazy(() => z.extend(z.omit(feedbackPayloadObject(), { turnstileToken: true }), {
    id: z.string(),
    timestamp: z.string(),
    ipAddress: z.optional(z.string()),
}));

export type StoredFeedback = z.infer<typeof storedFeedbackSchema>;
