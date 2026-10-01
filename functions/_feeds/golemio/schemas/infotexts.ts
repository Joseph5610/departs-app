import * as z from 'zod/mini';

export const golemioInfotextSchema = z.lazy(() => z.object({
    id: z.string(),
    priority: z.catch(z.enum(['low', 'normal', 'high']), 'normal'),
    display_type: z.catch(z.enum(['inline', 'general']), 'general'),
    text: z.string(),
    text_en: z.nullable(z.string()),
    related_stops: z.pipe(z.array(z.catch(z.nullable(z.object({
        id: z.string(),
        name: z.string(),
        platform_code: z.nullable(z.string())
    })), null)), z.transform(arr => arr.filter((s): s is NonNullable<typeof s> => s !== null))),
    valid_from: z.string(),
    valid_to: z.nullable(z.string())
}));

export type GolemioInfotext = z.infer<typeof golemioInfotextSchema>;
