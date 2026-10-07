import type { RSSItem, Infotext } from '@/types';
import { routeTypeRank } from '@/domain/routes/routeType';
import { normalizeString } from '@/lib/strings';

/**
 * Whether an alert priority (RSS string or GTFS-RT numeric code) is high.
 */
export const isHighPriorityAlert = (priority: string | undefined | null): boolean =>
    priority === 'high' || priority === '1';

/** Which alerts the alerts list shows. */
export type AlertFilterMode = 'all' | 'incident' | 'exclusion';

export interface AlertSection {
    mode: string;
    items: RSSItem[];
}

/** The mode an alert is listed under: its first line's, trolleybuses with buses, `other` without lines. */
const getTransportMode = (item: RSSItem): string => {
    if (!item.line_metadata || item.line_metadata.length === 0) return 'other';

    for (const meta of item.line_metadata) {
        const type = meta.type;
        
        if (type === 'trolleybus') return 'bus';
        if (!type || type === 'unknown') continue;

        return type;
    }

    return 'other';
};

/**
 * The alerts list: filtered by type and a search over title, description and line names, grouped by mode
 * in mode order; within a mode incidents first, then active ones, then high priority.
 */
export const alertSections = (alerts: RSSItem[], filterMode: AlertFilterMode, searchQuery: string): AlertSection[] => {
    const q = normalizeString(searchQuery.trim());
    const filtered = alerts.filter(item => {
        if (filterMode === 'incident' && item.type !== 'incident') return false;
        if (filterMode === 'exclusion' && item.type !== 'exclusion') return false;

        if (q) {
            const matchesTitle = normalizeString(item.title).includes(q);
            const matchesDesc = item.description ? normalizeString(item.description).includes(q) : false;
            const matchesLine = item.line_metadata?.some((m) => m.name && normalizeString(m.name).includes(q));
            if (!matchesTitle && !matchesDesc && !matchesLine) return false;
        }
        return true;
    });

    const groupedMap = new Map<string, RSSItem[]>();
    filtered.forEach(item => {
        const mode = getTransportMode(item);
        if (!groupedMap.has(mode)) groupedMap.set(mode, []);
        groupedMap.get(mode)!.push(item);
    });

    const sortedModes = Array.from(groupedMap.keys()).sort((a, b) => routeTypeRank(a) - routeTypeRank(b));

    return sortedModes.map(mode => {
        const groupItems = groupedMap.get(mode)!;
        groupItems.sort((a, b) => {
            if (a.type === 'incident' && b.type !== 'incident') return -1;
            if (a.type !== 'incident' && b.type === 'incident') return 1;

            if (a.isActive && !b.isActive) return -1;
            if (!a.isActive && b.isActive) return 1;

            return Number(isHighPriorityAlert(b.priority)) - Number(isHighPriorityAlert(a.priority));
        });
        return { mode, items: groupItems };
    });
};

/** The active alerts naming `routeName` among their lines, high priority first. */
export const alertsForLine = (alerts: RSSItem[], routeName: string): RSSItem[] => {
    const upperRouteName = routeName.toUpperCase();
    return alerts
        .filter(item => item.isActive && item.line_metadata?.some((m) => String(m.name).toUpperCase() === upperRouteName))
        .sort((a, b) => Number(isHighPriorityAlert(b.priority)) - Number(isHighPriorityAlert(a.priority)));
};

/** Stop notices posted for any of `stopIds`. */
export const noticesForStops = (infotexts: Infotext[], stopIds: string[]): Infotext[] => {
    const ids = new Set(stopIds);
    return infotexts.filter(info => info.relatedStopIds.some(id => ids.has(id)));
};

/** A notice's text in the UI language: English where the notice has it, Czech otherwise. */
export const noticeText = (info: Infotext, language: string | undefined): string =>
    language === 'en' && info.textEn ? info.textEn : info.text;

/** Notices whose validity window holds `now`; one without an end stays valid. */
export const activeNotices = (notices: Infotext[], now: number): Infotext[] =>
    notices.filter(info => Date.parse(info.valid_from) <= now && (!info.valid_to || Date.parse(info.valid_to) > now));
