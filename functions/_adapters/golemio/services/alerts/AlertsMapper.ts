import { AppRSSItem } from "../../../../_core/types";
import { formatDate } from "../../../../_core/api-utils";
import { getVehicleColor } from "../vehicles/colors";
import { XMLParser } from "fast-xml-parser";

export class AlertsMapper {
    private static guessType(name: string): string {
        const n = String(name).toUpperCase();
        if (['A', 'B', 'C'].includes(n)) return 'metro';
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
     * @param type The type of alerts to parse (incidents or exclusions)
     * @returns Array of parsed AppRSSItem objects
     */
    static mapRSS(xmlString: string, type: 'incidents' | 'exclusions'): AppRSSItem[] {
        const itemType = type === 'incidents' ? 'incident' : 'exclusion';
        
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_"
        });
        
        const jObj = parser.parse(xmlString);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let parsedItems: any[] = [];
        
        if (jObj && jObj.rss && jObj.rss.channel && jObj.rss.channel.item) {
            if (Array.isArray(jObj.rss.channel.item)) {
                parsedItems = jObj.rss.channel.item;
            } else {
                parsedItems = [jObj.rss.channel.item];
            }
        }

        const now = new Date();
        const items: AppRSSItem[] = [];

        const dateRangeRegex = /(\d{1,2}\.\s*\d{1,2}\.\s*(?:\d{4}\s*)?\d{1,2}:\d{2})\s*-\s*(.*?)(?=\s*(?:;|<|(?:Dotčené\s+)?(?:L|l)inky:|Z\s+důvodu|$))/i;
        const datePartsRegex = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{1,2}:\d{2})/i;
        const linesRegex = /(?:Dotčené\s+)?(?:L|l)inky:\s*([A-Za-z0-9,\s]+?)(?=<br>|Z\s+důvodu|;|$|Etapa|\.|Vážení)/i;

        for (const item of parsedItems) {
            const title = item.title || "";
            const pubDate = item.pubDate || "";
            const guid = item.guid ? (typeof item.guid === 'object' ? item.guid["#text"] : item.guid) : null;
            const link = item.link || null;
            const priority = item.priority ? String(item.priority) : null;
            
            // For incidents, description is usually in 'description', for exclusions it's 'content:encoded' or 'description'
            const description = (item["content:encoded"] || item.description || "").toString().replace(/&nbsp;/ig, ' ');

            // lines parsing
            let lines: string[] = [];
            if (item.lines && item.lines.line) {
                if (Array.isArray(item.lines.line)) {
                    lines = item.lines.line.map(String);
                } else {
                    lines = [String(item.lines.line)];
                }
            } else {
                const linesDescMatch = description.match(linesRegex);
                if (linesDescMatch && linesDescMatch[1]) {
                    lines = linesDescMatch[1]
                        .replace(/\s+(?:a|A)\s+/g, ',')
                        .split(',')
                        .map(l => l.trim())
                        .filter(Boolean);
                }
            }
            
            // Deduplicate lines
            lines = Array.from(new Set(lines));

            let isActive = true;
            let isFuture = false;
            let valid_from: string | null = null;
            let valid_to: string | null = null;

            const parseAndFormat = (str: string) => {
                const match = str.match(datePartsRegex);
                if (!match) return str.trim();
                const [, d, m, time] = match;
                const day = parseInt(d);
                const month = parseInt(m);

                let year = now.getFullYear();
                if (month - 1 > now.getMonth() + 1) year--;
                else if (month - 1 < now.getMonth() - 10) year++;

                const [h, min] = time.split(':');
                const paddedH = h.padStart(2, '0');

                return `${day}. ${month}. ${year} ${paddedH}:${min}`;
            };

            if (type === 'incidents') {
                const dateMatch = description.match(dateRangeRegex);
                if (dateMatch) {
                    valid_from = parseAndFormat(dateMatch[1]);
                    const toStr = dateMatch[2].trim();
                    if (toStr.toLowerCase().includes('odvolání')) {
                        valid_to = null;
                    } else {
                        valid_to = parseAndFormat(toStr);
                    }
                }

                if (!valid_from) {
                    const rawDate = item.date || "";
                    if (rawDate) {
                        valid_from = rawDate;
                    } else if (pubDate) {
                        valid_from = formatDate(new Date(pubDate));
                    }
                }

                isActive = true;
                isFuture = false;
            } else {
                // Exclusions
                const start = item.dateFrom ? new Date(Number(item.dateFrom) * 1000) : null;
                const end = item.dateTo ? new Date(Number(item.dateTo) * 1000) : null;

                if (start) {
                    valid_from = formatDate(start);
                    if (start > now) {
                        isActive = false;
                        isFuture = true;
                    }
                }
                if (end) {
                    valid_to = formatDate(end);
                    if (end < now) {
                        isActive = false;
                    }
                }
            }

            // Clean description
            let cleanedDescription = description
                .replace(dateRangeRegex, '')
                .replace(linesRegex, '')
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            cleanedDescription = cleanedDescription.replace(/^[;\s.]+|[;\s.]+$/g, '');

            items.push({
                type: itemType,
                title: String(title).trim(),
                description: cleanedDescription || null,
                link: link ? String(link).trim() : "",
                valid_from,
                valid_to,
                guid: guid ? String(guid).trim() : undefined,
                priority: priority ? String(priority) : undefined,
                lines,
                line_metadata: lines.map(name => {
                    const t = AlertsMapper.guessType(name);
                    return {
                        name,
                        type: String(t === 'metro' ? 1 : t === 'tram' ? 0 : t === 'train' ? 2 : t === 'trolleybus' ? 11 : 3),
                        route_color: getVehicleColor(t === 'metro' ? '1' : t === 'tram' ? '0' : t === 'train' ? '2' : t === 'trolleybus' ? '11' : '3', name)
                    };
                }),
                isActive,
                isFuture
            });
        }

        return items;
    }
}
