import { z } from 'zod';

export const golemioInfotextSchema = z.object({
    id: z.string(),
    priority: z.enum(['low', 'normal', 'high']).catch('normal'),
    display_type: z.enum(['inline', 'general']).catch('general'),
    text: z.string(),
    text_en: z.string().nullable(),
    related_stops: z.array(z.object({
        id: z.string(),
        name: z.string(),
        platform_code: z.string().nullable()
    }).nullable().catch(null)).transform(arr => arr.filter((s): s is NonNullable<typeof s> => s !== null)),
    valid_from: z.string(),
    valid_to: z.string().nullable()
});

export type GolemioInfotext = z.infer<typeof golemioInfotextSchema>;
