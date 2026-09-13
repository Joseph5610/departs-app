import { z } from 'zod';
import { API_LIMITS } from './config';

/**
 * Zod schemas for the feedback endpoint body and the entries it stores in KV.
 * Unknown keys are stripped, so a diagnostics field the client starts sending must be added here too.
 */

const diagnosticDataSchema = z.object({
    url: z.string(),
    userAgent: z.string(),
    appVersion: z.string(),
    windowSize: z.object({ width: z.number(), height: z.number() }).optional(),
    connectionType: z.string().optional(),
    sessionDurationSec: z.number().optional(),
    devicePixelRatio: z.number().optional(),
    hardwareConcurrency: z.number().optional(),
    deviceMemory: z.number().optional(),
    timezone: z.string().optional(),
    activeLayers: z.array(z.string()).optional(),
    selectedVehicleId: z.string().optional(),
    selectedStopId: z.string().optional(),
    isFollowing: z.boolean().optional(),
    selectedCity: z.string().optional(),
    showVehicles: z.boolean().optional(),
    showStops: z.boolean().optional(),
    mapBaseStyle: z.string().optional(),
    theme: z.string().optional(),
    locale: z.string().optional(),
    isPwa: z.boolean().optional(),
    gpsEnabled: z.boolean().optional(),
    crashInfo: z.object({
        errorName: z.string(),
        errorMessage: z.string(),
        errorStack: z.string().optional(),
        componentStack: z.string().optional(),
    }).optional(),
});

export const feedbackPayloadSchema = z.object({
    type: z.enum(['bug', 'feature_request', 'other', 'crash']),
    message: z.string().min(API_LIMITS.FEEDBACK_MESSAGE_MIN_CHARS).max(API_LIMITS.FEEDBACK_MESSAGE_MAX_CHARS),
    email: z.string().email().optional().or(z.literal('')),
    includeDiagnostics: z.boolean(),
    diagnostics: diagnosticDataSchema.optional(),
    turnstileToken: z.string().min(1),
});

export const storedFeedbackSchema = feedbackPayloadSchema.omit({ turnstileToken: true }).extend({
    id: z.string(),
    timestamp: z.string(),
    ipAddress: z.string().optional(),
});

export type StoredFeedback = z.infer<typeof storedFeedbackSchema>;
