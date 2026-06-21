import { z } from 'zod';

export const feedbackTypeEnum = z.enum(['bug', 'feature_request', 'other']);

export type FeedbackType = z.infer<typeof feedbackTypeEnum>;

// Represents the diagnostic data sent from the client
export const diagnosticDataSchema = z.object({
  url: z.string(),
  userAgent: z.string(),
  appVersion: z.string(),
  windowSize: z.object({ width: z.number(), height: z.number() }).optional(),
  // Device & Network
  connectionType: z.string().optional(),
  sessionDurationSec: z.number().optional(),
  devicePixelRatio: z.number().optional(),
  hardwareConcurrency: z.number().optional(),
  deviceMemory: z.number().optional(),
  timezone: z.string().optional(),

  // Zustand State Dump
  activeLayers: z.array(z.string()).optional(),
  
  selectedVehicleId: z.string().optional(),
  selectedStopId: z.string().optional(),
  isFollowing: z.boolean().optional(),

  // Preferences
  selectedCity: z.string().optional(),
  showVehicles: z.boolean().optional(),
  showStops: z.boolean().optional(),
  mapBaseStyle: z.string().optional(),
  
  theme: z.string().optional(),
  locale: z.string().optional(),
  isPwa: z.boolean().optional(),
  gpsEnabled: z.boolean().optional(),
});

export type DiagnosticData = z.infer<typeof diagnosticDataSchema>;

// Represents the payload sent to the API
export const feedbackPayloadSchema = z.object({
  type: feedbackTypeEnum,
  message: z.string().min(5, 'Message must be at least 5 characters long').max(2000, 'Message is too long'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  includeDiagnostics: z.boolean(),
  diagnostics: diagnosticDataSchema.optional(),
  turnstileToken: z.string().min(1, 'Please verify you are human'),
});

export type FeedbackPayload = z.infer<typeof feedbackPayloadSchema>;

// Represents the full stored entity in KV
export const storedFeedbackSchema = feedbackPayloadSchema.omit({ turnstileToken: true }).extend({
  id: z.string(),
  timestamp: z.string(),
  ipAddress: z.string().optional(),
});

export type StoredFeedback = z.infer<typeof storedFeedbackSchema>;
