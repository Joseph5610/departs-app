import { z } from 'zod';

export const pidRssItemSchema = z.object({
    title: z.union([z.string(), z.number()]).transform(val => String(val).trim()).optional().catch(""),
    pubDate: z.union([z.string(), z.number()]).transform(val => String(val).trim()).optional().catch(""),
    guid: z.any().transform(val => {
        if (!val) return null;
        if (typeof val === 'object' && val["#text"]) return String(val["#text"]).trim();
        return String(val).trim();
    }).optional().catch(null),
    link: z.union([z.string(), z.number()]).transform(val => String(val).trim()).nullable().optional().catch(null),
    priority: z.any().transform(val => val ? String(val).trim() : null).optional().catch(null),
    "content:encoded": z.any().transform(val => val ? String(val) : null).optional().catch(null),
    description: z.any().transform(val => val ? String(val) : null).optional().catch(null),
    date: z.union([z.string(), z.number()]).transform(String).optional().catch(""),
    dateFrom: z.union([z.string(), z.number()]).transform(String).nullable().optional().catch(null),
    dateTo: z.union([z.string(), z.number()]).transform(String).nullable().optional().catch(null),
    lines: z.any().transform(val => {
        if (!val || !val.line) return null;
        if (Array.isArray(val.line)) return val.line.map(String);
        return [String(val.line)];
    }).optional().catch(null)
});



export const golemioRouteSchema = z.object({
    route_id: z.string(),
    route_short_name: z.string(),
    route_type: z.number(),
    route_color: z.string().optional()
});


