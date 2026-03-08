import { CACHE_TTL, ERROR_MESSAGES, TRANSIT_CONFIG, createErrorResponse } from "../_utils/api-utils";
import { getXMLTagContent } from "../_utils/rss-utils";
import { AppRSSItem, AppRSSResponse } from "../_utils/types";

export const onRequest: PagesFunction = async () => {
    try {
        const [incidentsXml, exclusionsXml] = await Promise.all([
            fetchFeed(TRANSIT_CONFIG.RSS_FEEDS.incidents),
            fetchFeed(TRANSIT_CONFIG.RSS_FEEDS.exclusions)
        ]);

        const incidents = parseRSS(incidentsXml, 'incidents');
        const exclusions = parseRSS(exclusionsXml, 'exclusions');

        const response: AppRSSResponse = {
            alerts: [...incidents, ...exclusions]
        };

        return new Response(JSON.stringify(response), {
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                'Cache-Control': `public, max-age=${CACHE_TTL.RSS_INCIDENTS}`
            }
        });
    } catch (error) {
        console.error("RSS API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.RSS_FEED_ERROR);
    }
};

async function fetchFeed(url: string): Promise<string> {
    const isExclusion = url.includes('vyluky');
    const cacheTtl = isExclusion ? CACHE_TTL.RSS_EXCLUSIONS : CACHE_TTL.RSS_INCIDENTS;

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; departs-app/0.1; +https://departs.app)',
            'Accept': 'application/rss+xml, application/xml, text/xml'
        },
        cf: {
            cacheTtl,
            cacheEverything: true
        }
    });

    if (!response.ok) throw new Error(`Upstream error: ${response.status}`);
    return await response.text();
}

/**
 * Formats a date into D. M. YYYY HH:mm in Europe/Prague timezone.
 */
function formatPragueDate(date: Date): string {
    const d = new Intl.DateTimeFormat('cs-CZ', {
        timeZone: 'Europe/Prague',
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    }).formatToParts(date);

    const get = (type: string) => d.find(p => p.type === type)?.value;
    return `${get('day')}. ${get('month')}. ${get('year')} ${get('hour')?.padStart(2, '0')}:${get('minute')?.padStart(2, '0')}`;
}

function parseRSS(xmlString: string, type: 'incidents' | 'exclusions'): AppRSSItem[] {
    const itemType = type === 'incidents' ? 'incident' : 'exclusion';
    const items: AppRSSItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;

    const now = new Date();

    while ((match = itemRegex.exec(xmlString)) !== null) {
        const itemXml = match[1];
        const title = getXMLTagContent(itemXml, 'title');
        const description = getXMLTagContent(itemXml, 'description');

        const dateFromTag = getXMLTagContent(itemXml, 'dateFrom');
        const dateToTag = getXMLTagContent(itemXml, 'dateTo');

        let isActive = true;
        let isFuture = false;
        let valid_from: string | null = null;
        let valid_to: string | null = null;

        if (type === 'incidents') {
            // Parsing incidents from description: "7.3. 20:32 - do&nbsp;odvolání" or "7.3. 08:00 - 8.3. 21:00"
            const datePartsRegex = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{1,2}:\d{2})/i;
            const dateMatch = description.match(/(\d{1,2}\.\s*\d{1,2}\.\s*\d{1,2}:\d{2})\s*-\s*([^;]+)/i);

            if (dateMatch) {
                const parseAndFormat = (str: string) => {
                    const match = str.match(datePartsRegex);
                    if (!match) return str;
                    const [_, d, m, time] = match;
                    const day = parseInt(d);
                    const month = parseInt(m);

                    let year = now.getFullYear();
                    // Incident feeds often lack year.
                    if (month - 1 > now.getMonth() + 1) year--;
                    else if (month - 1 < now.getMonth() - 10) year++;

                    const [h, min] = time.split(':');
                    const paddedH = h.padStart(2, '0');

                    return `${day}. ${month}. ${year} ${paddedH}:${min}`;
                };

                valid_from = parseAndFormat(dateMatch[1]);
                let toStr = dateMatch[2].replace(/&nbsp;/g, ' ').trim();
                if (toStr.toLowerCase().includes('odvolání')) {
                    valid_to = null;
                } else {
                    valid_to = parseAndFormat(toStr);
                }
            } else {
                const rawDate = getXMLTagContent(itemXml, 'date');
                if (rawDate) {
                    valid_from = rawDate;
                }
            }
            isActive = true;
            isFuture = false;
        } else {
            // Exclusions
            const start = dateFromTag && /^\d+$/.test(dateFromTag) ? new Date(parseInt(dateFromTag) * 1000) : null;
            const end = dateToTag && /^\d+$/.test(dateToTag) ? new Date(parseInt(dateToTag) * 1000) : null;

            if (start) {
                valid_from = formatPragueDate(start);
                if (start > now) {
                    isActive = false;
                    isFuture = true;
                }
            }
            if (end) {
                valid_to = formatPragueDate(end);
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
                lines = lineMatches.map(l => l.replace(/<\/?line>/gi, '').trim()).filter(Boolean);
            }
        } else {
            const linesDescMatch = description.match(/Dotčené linky:\s*([A-Z0-9,\s]+)/i);
            if (linesDescMatch && linesDescMatch[1]) {
                lines = linesDescMatch[1].split(',').map(l => l.trim()).filter(Boolean);
            }
        }

        items.push({
            type: itemType,
            title,
            link: getXMLTagContent(itemXml, 'link'),
            valid_from,
            valid_to,
            guid: getXMLTagContent(itemXml, 'guid'),
            priority: getXMLTagContent(itemXml, 'priority'),
            lines,
            isActive,
            isFuture
        });
    }

    return items;
}
