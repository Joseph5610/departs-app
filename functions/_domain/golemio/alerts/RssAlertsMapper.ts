import { AppAlert } from "../../../_core/types";
import type { PidRssItem } from "../../../_feeds/golemio/rss-exclusions";
import { AlertTextFormatter } from "../../../_core/utils/AlertTextFormatter";

const LEADING_SEPARATOR = /[;\s.]/;
const TRAILING_SEPARATOR = /[;\s]/;

/** Drops leading `;`, `.` and whitespace, and trailing `;` and whitespace. */
function trimSeparators(text: string): string {
    let start = 0;
    let end = text.length;
    while (start < end && LEADING_SEPARATOR.test(text[start])) start++;
    while (end > start && TRAILING_SEPARATOR.test(text[end - 1])) end--;
    return text.slice(start, end);
}

export class RssAlertsMapper {

    /** Maps validated PID RSS items (planned exclusions) into alerts. */
    static mapRSS(parsedItems: PidRssItem[]): AppAlert[] {
        const itemType = 'exclusion';

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

            const valid_from = item.dateFrom ? new Date(Number(item.dateFrom) * 1000).toISOString() : null;
            const valid_to = item.dateTo ? new Date(Number(item.dateTo) * 1000).toISOString() : null;

            // Clean description
            const cleanedDescription = trimSeparators(AlertTextFormatter.fromHtml(
                description.replace(dateRangeRegex, '').replace(linesRegex, '')
            ) || '');

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
            });
        }

        return items;
    }
}
