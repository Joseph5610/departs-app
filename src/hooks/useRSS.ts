
import { useQuery } from '@tanstack/react-query';
import { API_ENDPOINTS } from '../config/api';

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
    isActive?: boolean;
    isFuture?: boolean;
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

const fetchFeed = async (type: string): Promise<RSSFeed> => {
    const res = await fetch(API_ENDPOINTS.RSS(type));
    if (!res.ok) throw new Error(`Failed to fetch feed: ${res.statusText}`);
    return await res.json();
};

export const useRSS = (type: 'incidents' | 'exclusions') => {
    return useQuery({
        queryKey: ['rss', type],
        queryFn: () => fetchFeed(FEEDS[type]),
        refetchInterval: type === 'incidents' ? 5 * 60 * 1000 : 60 * 60 * 1000,
        staleTime: type === 'incidents' ? 5 * 60 * 1000 : 60 * 60 * 1000,
    });
};
