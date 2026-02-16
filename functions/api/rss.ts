import { createErrorResponse } from "../_utils/api-utils";

/**
 * Normalizes a date string from PID RSS format.
 */
const normalizeDate = (dateStr: string, referenceDate: Date = new Date(), pubDate?: string): Date | null => {
    const normalized = dateStr.trim();
    if (!normalized || normalized.toLowerCase().includes('do odvolání')) return null;

    if (normalized.match(/^\d{10,}$/)) {
        const d = new Date(parseInt(normalized) * 1000);
        return isNaN(d.getTime()) ? null : d;
    }

    try {
        const refYear = pubDate ? new Date(pubDate).getFullYear() : referenceDate.getFullYear();

        const partialMatch = normalized.match(/^(\d{1,2})\.(\d{1,2})\. (\d{1,2}):(\d{2})$/);
        if (partialMatch) {
            const [, d, m, hh, mm] = partialMatch;
            const date = new Date(refYear, parseInt(m) - 1, parseInt(d), parseInt(hh), parseInt(mm));
            return isNaN(date.getTime()) ? null : date;
        }

        const fullMatch = normalized.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}) (\d{1,2}):(\d{2})$/);
        if (fullMatch) {
            const [, d, m, y, hh, mm] = fullMatch;
            const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(hh), parseInt(mm));
            return isNaN(date.getTime()) ? null : date;
        }

        const d = new Date(normalized.includes(' ') ? normalized.replace(' ', 'T') : normalized);
        return isNaN(d.getTime()) ? null : d;
    } catch {
        return null;
    }
};

const getTag = (xml: string, tag: string): string => {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return (match ? match[1] : "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&nbsp;/g, ' ').trim();
};

export const onRequest: PagesFunction = async (context) => {
    const { searchParams } = new URL(context.request.url);
    const type = searchParams.get('type') as 'incidents' | 'exclusions';

    const FEEDS = {
        incidents: 'https://pid.cz/feed/rss-mimoradnosti/',
        exclusions: 'https://pid.cz/feed/rss-vyluky/'
    };

    const targetUrl = FEEDS[type];
    if (!targetUrl) return createErrorResponse('Missing or invalid type parameter', 400);

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; departs-app/0.1; +https://departs.app)',
                'Accept': 'application/rss+xml, application/xml, text/xml'
            }
        });

        if (!response.ok) return createErrorResponse(`Upstream error: ${response.status}`, response.status);

        const xmlString = await response.text();
        const items: any[] = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
        let match;

        const now = new Date();

        while ((match = itemRegex.exec(xmlString)) !== null) {
            const itemXml = match[1];
            const title = getTag(itemXml, 'title');
            const description = getTag(itemXml, 'description');
            const pubDate = getTag(itemXml, 'pubDate');
            const dateRange = getTag(itemXml, 'date') || description.split(';')[0]?.trim();

            const dateFrom = getTag(itemXml, 'dateFrom');
            const dateTo = getTag(itemXml, 'dateTo');

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

            const alert = {
                title,
                link: getTag(itemXml, 'link'),
                pubDate,
                isoDate: pubDate ? new Date(pubDate).toISOString() : now.toISOString(),
                contentSnippet: description.replace(/<[^>]*>?/gm, ''),
                guid: getTag(itemXml, 'guid'),
                date: dateRange,
                dateFrom,
                dateTo,
                priority: getTag(itemXml, 'priority'),
                lines,
                type
            };

            let isActive = true;
            let isFuture = false;

            if (type === 'exclusions') {
                let start = normalizeDate(dateFrom || '', now, alert.isoDate);
                let end = normalizeDate(dateTo || '', now, alert.isoDate);

                if (!start && dateRange) {
                    const parts = dateRange.split('-');
                    if (parts.length >= 1) start = normalizeDate(parts[0], now, alert.isoDate);
                    if (!end && parts.length >= 2) end = normalizeDate(parts[1], now, alert.isoDate);
                }

                if (start && start > now) {
                    isActive = false;
                    isFuture = true;
                } else if (end && end < now) {
                    isActive = false;
                }
            }

            items.push({ ...alert, isActive, isFuture });
        }

        const channelTitle = xmlString.match(/<channel>[\s\S]*?<title>([\s\S]*?)<\/title>/i)?.[1] || "";

        return new Response(JSON.stringify({
            title: channelTitle.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim(),
            items
        }), {
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': type === 'incidents' ? 'public, max-age=300' : 'public, max-age=3600'
            }
        });
    } catch (error) {
        return createErrorResponse(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
};
