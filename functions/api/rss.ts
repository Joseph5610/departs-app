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

        // Internal logic: Attempt to calculate activity status
        let start = normalizeRSSDate(dateFrom || '', now, pubDate);
        let end = normalizeRSSDate(dateTo || '', now, pubDate);

        if (!start && dateRange) {
            const parts = dateRange.split('-');
            if (parts.length >= 1) start = normalizeRSSDate(parts[0], now, pubDate);
            if (!end && parts.length >= 2) end = normalizeRSSDate(parts[1], now, pubDate);
        }

        let isActive = true;
        let isFuture = false;

        if (start && start > now) {
            isActive = false;
            isFuture = true;
        } else if (end && end < now) {
            isActive = false;
        }

        // Incidents are forced to active
        if (type === 'incidents') {
            isActive = true;
            isFuture = false;
        }

        // Internal logic: Determine primary timestamp for sorting
        let timestamp = now.toISOString();
        if (pubDate) {
            timestamp = new Date(pubDate).toISOString();
        } else if (start) {
            timestamp = start.toISOString();
        }

        items.push({
            type: itemType,
            title,
            link: getXMLTagContent(itemXml, 'link'),
            timestamp, // included for sorting, will be stripped before response
            displayDate: dateRange || undefined,
            guid: getXMLTagContent(itemXml, 'guid'),
            priority: getXMLTagContent(itemXml, 'priority'),
            lines,
            isActive,
            isFuture
        } as any);
    }

    // Sort: Active first, Future (planned) last. Within groups, newest first.
    return items
        .sort((a: any, b: any) => {
            if (a.isFuture && !b.isFuture) return 1;
            if (!a.isFuture && b.isFuture) return -1;
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        })
        .map(({ timestamp, ...item }: any) => item as AppRSSItem);
}
