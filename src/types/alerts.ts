import type { RouteType } from './vehicles';

export interface RSSItem {
    type: 'incident' | 'exclusion';
    title: string;
    description: string | null;
    /** ISO 8601 instant. */
    valid_from: string | null;
    /** ISO 8601 instant. */
    valid_to: string | null;
    link: string;
    guid?: string;
    priority?: string;
    /**
     * One entry per affected route. GTFS-RT-sourced alerts (KORDIS/PID) arrive with only `route_id`
     * set - raw and unresolved - and get `name`/`type`/`route_color` filled in by
     * `enrichAlertLineMetadata` from the same routes.json join vehicles/departures use. RSS-sourced
     * exclusions arrive with `name`/`type` already set (no route id exists for them) and only pick
     * up `route_color` from that same enrichment step.
     */
    line_metadata?: Array<{ route_id?: string; name?: string; route_color?: string; type?: RouteType }>;
    isActive?: boolean;
    isFuture?: boolean;
    cause?: string;
    causeDetail?: { cs?: string; en?: string };
    effect?: string;
}

export interface Infotext {
    id: string;
    text: string;
    textEn: string | null;
    priority: 'low' | 'normal' | 'high';
    displayType: 'inline' | 'general';
    relatedStopIds: string[];
    /** ISO 8601 instant. */
    valid_from: string;
    /** ISO 8601 instant. */
    valid_to: string | null;
}
