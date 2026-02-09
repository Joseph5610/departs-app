
import { useQuery } from '@tanstack/react-query';

export interface RSSItem {
    title: string;
    link: string;
    pubDate: string;
    content: string;
    contentSnippet: string;
    guid: string;
    isoDate: string;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    priority?: string;
    lines?: string[];
    type?: 'incidents' | 'exclusions';
}

export interface RSSFeed {
    title: string;
    description: string;
    link: string;
    items: RSSItem[];
}

const FEEDS = {
    incidents: 'incidents',
    exclusions: 'exclusions'
};

const parseRSS = (xmlString: string): RSSFeed => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    const channel = xmlDoc.querySelector("channel");
    const items = Array.from(xmlDoc.querySelectorAll("item")).map(item => {
        const getTag = (tag: string) => (item.querySelector(tag)?.textContent || "").replace(/&nbsp;/g, ' ');
        const description = getTag("description");

        const getLines = () => {
            // Try structured <lines> tag first
            const linesTag = item.querySelector("lines");
            if (linesTag) {
                return Array.from(linesTag.querySelectorAll("line")).map(l => l.textContent || "").filter(Boolean);
            }

            // Fallback for incidents: extract from description (e.g., "Dotčené linky: S11, 228")
            const match = description.match(/Dotčené linky:\s*([A-Z0-9,\s]+)/i);
            if (match && match[1]) {
                return match[1].split(',').map(l => l.trim()).filter(Boolean);
            }

            return [];
        };

        return {
            title: getTag("title"),
            link: getTag("link"),
            pubDate: getTag("pubDate"),
            content: getTag("content\\:encoded") || description,
            contentSnippet: description.replace(/<[^>]*>?/gm, ''),
            guid: getTag("guid"),
            isoDate: getTag("pubDate") ? new Date(getTag("pubDate")).toISOString() : new Date().toISOString(),
            date: (getTag("date") || description.split(';')[0]?.trim()).replace(/&nbsp;/g, ' '),
            dateFrom: getTag("dateFrom"),
            dateTo: getTag("dateTo"),
            priority: getTag("priority"),
            lines: getLines(),
            type: (xmlDoc.querySelector("channel > title")?.textContent?.toLowerCase().includes('výluky') ? 'exclusions' : 'incidents') as 'incidents' | 'exclusions'
        };
    });

    return {
        title: channel?.querySelector("title")?.textContent || "",
        description: channel?.querySelector("description")?.textContent || "",
        link: channel?.querySelector("link")?.textContent || "",
        items
    };
};

const fetchFeed = async (url: string): Promise<RSSFeed> => {
    const res = await fetch(`/api/rss?type=${url}`);
    if (!res.ok) throw new Error(`Failed to fetch feed: ${res.statusText}`);
    const xml = await res.text();
    return parseRSS(xml);
};

export const useRSS = (type: 'incidents' | 'exclusions') => {
    return useQuery({
        queryKey: ['rss', type],
        queryFn: () => fetchFeed(FEEDS[type]),
        refetchInterval: type === 'incidents' ? 5 * 60 * 1000 : 60 * 60 * 1000,
        staleTime: type === 'incidents' ? 5 * 60 * 1000 : 60 * 60 * 1000,
    });
};
