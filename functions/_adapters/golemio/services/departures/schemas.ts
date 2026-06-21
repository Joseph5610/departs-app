import { z } from 'zod';

export const golemioDepartureItemSchema = z.object({
    departure: z.object({
        timestamp_predicted: z.string().nullable().optional(),
        timestamp_scheduled: z.string(),
        delay_seconds: z.number().nullable().optional(),
        minutes: z.number().nullable().optional(),
    }),
    route: z.object({
        short_name: z.string(),
        type: z.union([z.string(), z.number()]),
    }),
    trip: z.object({
        id: z.string(),
        direction_id: z.union([z.string(), z.number()]).nullable().optional(),
        headsign: z.string(),
        is_canceled: z.boolean(),
    }),
    stop: z.object({
        id: z.string(),
        platform_code: z.string().nullable().optional(),
        sequence: z.number().nullable().optional(),
    }),
    vehicle: z.object({
        id: z.string().nullable().optional(),
        is_wheelchair_accessible: z.boolean().nullable().optional(),
        is_air_conditioned: z.boolean().nullable().optional(),
        has_charger: z.boolean().nullable().optional(),
    }).optional()
});

export type GolemioDepartureItem = z.infer<typeof golemioDepartureItemSchema>;
