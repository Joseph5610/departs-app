import { CACHE_TTL, ERROR_MESSAGES, TRANSIT_CONFIG, createErrorResponse, formatPragueDate } from "../_utils/api-utils";
import { getXMLTagContent } from "../_utils/rss-utils";
import { AppRSSItem, AppRSSResponse } from "../_utils/types";

export const onRequest: PagesFunction = async () => {
    try {
        const [incidentsRes, exclusionsRes] = await Promise.allSettled([
            fetchFeed(TRANSIT_CONFIG.RSS_FEEDS.incidents),
            fetchFeed(TRANSIT_CONFIG.RSS_FEEDS.exclusions)
        ]);

        const incidents = incidentsRes.status === 'fulfilled' ? parseRSS(incidentsRes.value, 'incidents') : [];
        const exclusions = exclusionsRes.status === 'fulfilled' ? parseRSS(exclusionsRes.value, 'exclusions') : [];

        if (incidentsRes.status === 'rejected' && exclusionsRes.status === 'rejected') {
            throw new Error("Both RSS feeds failed to fetch");
        }

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
                    valid_from = formatPragueDate(new Date(pubDate));
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
            isActive,
            isFuture
        });
    }

    return items;
}
