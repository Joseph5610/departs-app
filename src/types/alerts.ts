export interface RSSItem {
    type: 'incident' | 'exclusion';
    title: string;
    description: string | null;
    valid_from: string | null;
    valid_to: string | null;
    link: string;
    guid?: string;
    priority?: string;
    lines?: string[];
    line_metadata?: Array<{ name: string; route_color: string; type: string }>;
    isActive?: boolean;
    isFuture?: boolean;
    cause?: string;
    causeDetail?: { cs?: string; en?: string };
}

export interface AlertsResponse {
    alerts: RSSItem[];
    infotexts: Infotext[];
}

export interface Infotext {
    id: string;
    text: string;
    textEn: string | null;
    priority: 'low' | 'normal' | 'high';
    displayType: 'inline' | 'general';
    relatedStopIds: string[];
    valid_from: string;
    valid_to: string | null;
}
