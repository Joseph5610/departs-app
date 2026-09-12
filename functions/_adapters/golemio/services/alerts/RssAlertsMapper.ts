import { AppAlert, AppRouteType } from "../../../../_core/types";
import { formatDate } from "../../../../_core/api-utils";
import { getVehicleColor } from "../vehicles/colors";
import { XMLParser } from "fast-xml-parser";
import { z } from 'zod';
import { pidRssItemSchema } from "./schemas";
import { AlertTextFormatter } from "../../../../_core/utils/AlertTextFormatter";

const rssParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

/** The only part of the RSS document this codebase navigates. */
export interface RssDocument {
    rss?: { channel?: { item?: unknown } };
}

/** Shared PID RSS parse — the parser options must match wherever the feed is read. */
export function parseRssXml(xmlString: string): RssDocument {
    return rssParser.parse(xmlString) as RssDocument;
}

export class RssAlertsMapper {
    
    private static guessType(name: string): AppRouteType {
        const n = String(name).toUpperCase().trim();
        if (['A', 'B', 'C'].includes(n)) return 'metro';
        if (n === 'LD' || /^LD[0-9]/.test(n) || n.includes('LANOVKA')) return 'funicular';
        if (/^P[1-9][0-9]?$/.test(n)) return 'ferry';
        const num = parseInt(n, 10);
        if (!isNaN(num) && num >= 50 && num <= 60) return 'trolleybus';
        if (/^[1-9][0-9]?$/.test(n)) return 'tram';
        if (/^S[0-9]/.test(n) || /^R[0-9]/.test(n)) return 'train';
        if (/^9[0-9][0-9]?$/.test(n)) return n.length === 2 ? 'tram' : 'bus'; // Night tram 9x, night bus 9xx
        return 'bus'; // Default
    }

    /**
     * Maps a raw RSS XML string into an array of structured alert items.
     * 
     * @param xmlString The raw RSS XML string
     * @returns Array of parsed AppAlert objects (exclusions only)
     */
    static mapRSS(xmlString: string, timezone: string): AppAlert[] {
        const itemType = 'exclusion';
        
        const jObj = parseRssXml(xmlString);
        let rawItems: unknown[] = [];
        
        const item = jObj?.rss?.channel?.item;
        if (item) {
            rawItems = Array.isArray(item) ? item : [item];
        }

        // Validate structure with Zod and drop malformed items silently
        const safeArraySchema = z.array(pidRssItemSchema.nullable().catch(err => {
            console.warn("Skipping invalid RSS item:", err);
            return null;
        }));
        
        const parsedItems = safeArraySchema.parse(rawItems).filter((i): i is NonNullable<typeof i> => i !== null);

        const now = new Date();
        const items: AppAlert[] = [];

        const dateRangeRegex = /(\d{1,2}\.\s*\d{1,2}\.\s*(?:\d{4}\s*)?\d{1,2}:\d{2})\s*-\s*(.*?)(?=\s*(?:;|<|(?:Dotčené\s+)?(?:L|l)inky:|Z\s+důvodu|$))/i;
        const linesRegex = /(?:Dotčené\s+)?(?:L|l)inky:\s*([A-Za-z0-9,\s]+?)(?=<br>|Z\s+důvodu|;|$|Etapa|\.|Vážení)/i;

        for (const item of parsedItems) {
            const title = item.title || "";
            const guid = item.guid || null;
            const link = item.link || null;
            const priority = item.priority || null;
            
            // For exclusions it's 'content:encoded' or 'description'
            const description = (item["content:encoded"] || item.description || "").replace(/&nbsp;/ig, ' ');

            // lines parsing
            let lines: string[] = [];
            if (item.lines) {
                lines = item.lines;
            } else {
                const linesDescMatch = description.match(linesRegex);
                if (linesDescMatch && linesDescMatch[1]) {
                    lines = linesDescMatch[1]
                        .replace(/\s+(?:a|A)\s+/g, ',')
                        .split(',')
                        .map((l: string) => l.trim())
                        .filter(Boolean);
                }
            }
            
            // Deduplicate lines
            lines = Array.from(new Set(lines));

            let isActive = true;
            let isFuture = false;
            let valid_from: string | null = null;
            let valid_to: string | null = null;

            // Exclusions
            const start = item.dateFrom ? new Date(Number(item.dateFrom) * 1000) : null;
            const end = item.dateTo ? new Date(Number(item.dateTo) * 1000) : null;

            if (start) {
                valid_from = formatDate(start, timezone);
                if (start > now) {
                    isActive = false;
                    isFuture = true;
                }
            }
            if (end) {
                valid_to = formatDate(end, timezone);
                if (end < now) {
                    isActive = false;
                }
            }

            // Clean description
            const cleanedDescription = (AlertTextFormatter.fromHtml(
                description.replace(dateRangeRegex, '').replace(linesRegex, '')
            ) || '').replace(/^[;\s.]+|[;\s]+$/g, '');

            items.push({
                type: itemType,
                title: title,
                description: cleanedDescription || null,
                link: link || "",
                valid_from,
                valid_to,
                guid: guid || undefined,
                priority: priority || undefined,
                lines,
                line_metadata: lines.map(name => {
                    const t = RssAlertsMapper.guessType(name);
                    return {
                        name,
                        type: t,
                        route_color: getVehicleColor(t, name)
                    };
                }),
                isActive,
                isFuture
            });
        }

        return items;
    }
}
