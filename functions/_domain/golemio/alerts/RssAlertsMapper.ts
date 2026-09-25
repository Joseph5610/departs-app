import { AppAlert } from "../../../_core/types";
import type { PidRssItem } from "../../../_feeds/golemio/alerts";
import { AlertTextFormatter } from "../../../_core/utils/AlertTextFormatter";

export class RssAlertsMapper {

    /** Maps validated PID RSS items (planned exclusions) into alerts. */
    static mapRSS(parsedItems: PidRssItem[]): AppAlert[] {
        const itemType = 'exclusion';

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
                valid_from = start.toISOString();
                if (start > now) {
                    isActive = false;
                    isFuture = true;
                }
            }
            if (end) {
                valid_to = end.toISOString();
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
                line_metadata: lines.map(name => ({ name })),
                isActive,
                isFuture
            });
        }

        return items;
    }
}
