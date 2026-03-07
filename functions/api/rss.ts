import { CACHE_TTL, ERROR_MESSAGES, TRANSIT_CONFIG, createErrorResponse } from "../_utils/api-utils";
import { getXMLTagContent, normalizeRSSDate } from "../_utils/rss-utils";

export const onRequest: PagesFunction = async (context) => {
    const { searchParams } = new URL(context.request.url);
    const type = searchParams.get('type') as 'incidents' | 'exclusions';

    const targetUrl = type ? TRANSIT_CONFIG.RSS_FEEDS[type] : null;
    if (!targetUrl) return createErrorResponse(ERROR_MESSAGES.MISSING_PARAMS, 400);

    try {
        const cacheMaxAge = type === 'incidents' ? CACHE_TTL.RSS_INCIDENTS : CACHE_TTL.RSS_EXCLUSIONS;

        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; departs-app/0.1; +https://departs.app)',
                'Accept': 'application/rss+xml, application/xml, text/xml'
            },
            cf: {
                cacheTtl: cacheMaxAge,
                cacheEverything: true
            }
        });

        if (!response.ok) return createErrorResponse(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), response.status);

        const xmlString = await response.text();
        const items: unknown[] = [];
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

            // Process description into contentSnippet
            // 1. Replace <br> with spaces to avoid merging words
            // 2. Strip all other HTML tags
            let contentSnippet = description
                .replace(/<br\s*\/?>/gi, ' ')
                .replace(/<[^>]*>?/gm, '')
                .trim();

            // Strip dateRange if it's a prefix in the description
            if (dateRange && contentSnippet.startsWith(dateRange)) {
                contentSnippet = contentSnippet.slice(dateRange.length).trim();
            }

            // Remove redundant line information ("Dotčené linky: ..." or "Linky: ...")
            // These are already available in the 'lines' array and displayed as badges
            contentSnippet = contentSnippet
                .replace(/Dotčené linky:\s*([A-Z0-9,\s]+)/gi, '')
                .replace(/Linky:\s*([A-Z0-9,\s]+)/gi, '')
                .replace(/\s+/g, ' ')
                .trim();

            // Clean up leading/trailing punctuation like semicolons left after stripping prefixes
            contentSnippet = contentSnippet.replace(/^[;:\-\s]+|[;:\-\s]+$/g, '').trim();

            const alert = {
                title,
                link: getXMLTagContent(itemXml, 'link'),
                pubDate,
                isoDate: pubDate ? new Date(pubDate).toISOString() : now.toISOString(),
                contentSnippet,
                guid: getXMLTagContent(itemXml, 'guid'),
                date: dateRange,
                dateFrom,
                dateTo,
                priority: getXMLTagContent(itemXml, 'priority'),
                lines,
                type
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

        const channelTitleMatch = xmlString.match(/<channel>[\s\S]*?<title>([\s\S]*?)<\/title>/i);
        const channelTitle = channelTitleMatch ? channelTitleMatch[1] : "";

        return new Response(JSON.stringify({
            title: channelTitle.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim(),
            items
        }), {
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                'Cache-Control': `public, max-age=${cacheMaxAge}`
            }
        });
    } catch {
        return createErrorResponse(ERROR_MESSAGES.RSS_FEED_ERROR);
    }
};
