import { AppRSSItem } from "../../../../_core/types";
import { getXMLTagContent } from "./rss-utils";
import { formatDate } from "../../../../_core/api-utils";
import { getVehicleColor } from "../vehicles/colors";

export class AlertsMapper {
    private static guessType(name: string): string {
        const n = String(name).toUpperCase();
        if (['A', 'B', 'C'].includes(n)) return 'metro';
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
        const items: AppRSSItem[] = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
        let match: RegExpExecArray | null;

        const now = new Date();

        while ((match = itemRegex.exec(xmlString)) !== null) {
            const itemXml = match[1];
            const title = getXMLTagContent(itemXml, 'title');
            const description = getXMLTagContent(itemXml, 'description');
            const pubDate = getXMLTagContent(itemXml, 'pubDate');

            const dateFromTag = getXMLTagContent(itemXml, 'dateFrom');
            const dateToTag = getXMLTagContent(itemXml, 'dateTo');

            let isActive = true;
            let isFuture = false;
            let valid_from: string | null = null;
            let valid_to: string | null = null;

            const datePartsRegex = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{1,2}:\d{2})/i;
            const dateRangeRegex = /(\d{1,2}\.\s*\d{1,2}\.\s*\d{1,2}:\d{2})\s*-\s*([^;]+)/i;

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
                    const toStr = dateMatch[2].replace(/&nbsp;/g, ' ').trim();
                    if (toStr.toLowerCase().includes('odvolání')) {
                        valid_to = null;
                    } else {
                        valid_to = parseAndFormat(toStr);
                    }
                }

                if (!valid_from) {
                    const rawDate = getXMLTagContent(itemXml, 'date');
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
                const start = dateFromTag && /^\d+$/.test(dateFromTag) ? new Date(parseInt(dateFromTag) * 1000) : null;
                const end = dateToTag && /^\d+$/.test(dateToTag) ? new Date(parseInt(dateToTag) * 1000) : null;

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

            let lines: string[] = [];
            const linesMatch = itemXml.match(/<lines>([\s\S]*?)<\/lines>/i);
            if (linesMatch) {
                const lineMatches = linesMatch[1].match(/<line>([\s\S]*?)<\/line>/gi);
                if (lineMatches) {
                    lines = lineMatches.map((l: string) => l.replace(/<\/?line>/gi, '').trim()).filter(Boolean);
                }
            } else {
                const linesDescMatch = description.match(/Dotčené linky:\s*([A-Z0-9,\s]+)/i);
                if (linesDescMatch && linesDescMatch[1]) {
                    lines = linesDescMatch[1].split(',').map(l => l.trim()).filter(Boolean);
                }
            }

            // Clean description: remove the leading date range and "Dotčené linky"
            let cleanedDescription = description
                .replace(dateRangeRegex, '')
                .replace(/Dotčené linky:\s*([A-Z0-9,\s]+)/i, '')
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .trim();

            // Remove trailing semicolons or dots if they are left over
            cleanedDescription = cleanedDescription.replace(/^[;\s.]+|[;\s.]+$/g, '');

            items.push({
                type: itemType,
                title,
                description: cleanedDescription || null,
                link: getXMLTagContent(itemXml, 'link'),
                valid_from,
                valid_to,
                guid: getXMLTagContent(itemXml, 'guid'),
                priority: getXMLTagContent(itemXml, 'priority'),
                lines,
                line_metadata: lines.map(name => {
                    const type = AlertsMapper.guessType(name);
                    return {
                        name,
                        type: String(type === 'metro' ? 1 : type === 'tram' ? 0 : type === 'train' ? 2 : 3),
                        route_color: getVehicleColor(type === 'metro' ? '1' : type === 'tram' ? '0' : type === 'train' ? '2' : '3', name)
                    };
                }),
                isActive,
                isFuture
            });
        }

        return items;
    }
}
