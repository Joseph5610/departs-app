import { CACHE_TTL, ERROR_MESSAGES, TRANSIT_CONFIG, createErrorResponse } from "../_utils/api-utils";
import { getXMLTagContent, normalizeRSSDate } from "../_utils/rss-utils";
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
            incidents,
            exclusions
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
    const items: AppRSSItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;

    const now = new Date();

    while ((match = itemRegex.exec(xmlString)) !== null) {
        const itemXml = match[1];
        const title = getXMLTagContent(itemXml, 'title');
        const description = getXMLTagContent(itemXml, 'description');
        const pubDate = getXMLTagContent(itemXml, 'pubDate');

        const dateTag = getXMLTagContent(itemXml, 'date');
        const dateRangeFallback = type === 'incidents' && description.includes(';')
            ? description.split(';')[0].trim()
            : '';
        const dateRange = dateTag || dateRangeFallback;

        const dateFrom = getXMLTagContent(itemXml, 'dateFrom');
        const dateTo = getXMLTagContent(itemXml, 'dateTo');

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

        const alert: AppRSSItem = {
            title,
            link: getXMLTagContent(itemXml, 'link'),
            pubDate,
            isoDate: pubDate ? new Date(pubDate).toISOString() : now.toISOString(),
            guid: getXMLTagContent(itemXml, 'guid'),
            date: dateRange,
            dateFrom,
            dateTo,
            priority: getXMLTagContent(itemXml, 'priority'),
            lines
        };

        let isActive = true;
        let isFuture = false;

        // Attempt to calculate activity status for both incidents and exclusions
        let start = normalizeRSSDate(dateFrom || '', now, alert.isoDate);
        let end = normalizeRSSDate(dateTo || '', now, alert.isoDate);

        if (!start && dateRange) {
            const parts = dateRange.split('-');
            if (parts.length >= 1) start = normalizeRSSDate(parts[0], now, alert.isoDate);
            if (!end && parts.length >= 2) end = normalizeRSSDate(parts[1], now, alert.isoDate);
        }

        if (start && start > now) {
            isActive = false;
            isFuture = true;
        } else if (end && end < now) {
            isActive = false;
        }

        // Incidents are always considered active if they are in the feed
        if (type === 'incidents') {
            isActive = true;
            isFuture = false;
        }

        items.push({ ...alert, isActive, isFuture });
    }

    return items;
}
