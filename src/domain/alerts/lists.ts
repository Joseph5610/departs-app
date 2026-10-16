import type { RSSItem, Infotext } from '@/types';
import { routeTypeRank } from '@/domain/routes/routeType';
import { normalizeString } from '@/lib/strings';

/**
 * Whether an alert priority (RSS string or GTFS-RT numeric code) is high.
 */
export const isHighPriorityAlert = (priority: string | undefined | null): boolean =>
    priority === 'high' || priority === '1';

/** How many of the alerts are incidents (disruptions now), the count the alerts buttons badge. */
export const countIncidents = (alerts: readonly RSSItem[] | undefined): number =>
    alerts?.filter(a => a.type === 'incident').length ?? 0;

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

/**
 * The active incidents on any of `lineNames` (compared case-insensitively), high priority first:
 * what the home sheet raises as disruptions on the rider's own lines.
 */
export const incidentsOnLines = (alerts: readonly RSSItem[] | undefined, lineNames: ReadonlySet<string>): RSSItem[] => {
    if (!alerts || lineNames.size === 0) return [];
    const names = new Set([...lineNames].map(n => n.toUpperCase()));
    return alerts
        .filter(item => item.type === 'incident' && item.isActive && item.line_metadata?.some(m => names.has(String(m.name).toUpperCase())))
        .sort((a, b) => Number(isHighPriorityAlert(b.priority)) - Number(isHighPriorityAlert(a.priority)));
};

/** Stop notices posted for any of `stopIds`. */
export const noticesForStops = (infotexts: Infotext[], stopIds: string[]): Infotext[] => {
    const ids = new Set(stopIds);
    return infotexts.filter(info => info.relatedStopIds.some(id => ids.has(id)));
};

/** The notices of one platform of a station board, keyed by the code its departures carry. */
export interface PlatformNotices {
    code: string;
    notices: Infotext[];
}

const PRIORITY_RANK: Record<Infotext['priority'], number> = { high: 0, normal: 1, low: 2 };

/**
 * A station board's notices split by platform, in platform order: `platforms` maps each platform id to
 * its code. Notices posted for the station itself or a platform without a code are `station`, shown whole.
 */
export const noticesByPlatform = (infotexts: Infotext[], stationIds: string[], platforms: ReadonlyMap<string, string>): { station: Infotext[]; platforms: PlatformNotices[] } => {
    const station = new Set<Infotext>();
    const byCode = new Map<string, Set<Infotext>>();
    const ids = new Set(stationIds);
    for (const info of infotexts) {
        for (const id of info.relatedStopIds) {
            if (!ids.has(id)) continue;
            const code = platforms.get(id);
            if (!code) { station.add(info); continue; }
            const set = byCode.get(code) ?? new Set();
            set.add(info);
            byCode.set(code, set);
        }
    }
    const byPriority = (a: Infotext, b: Infotext) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    return {
        station: [...station].sort(byPriority),
        platforms: [...byCode]
            .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
            .map(([code, set]) => ({ code, notices: [...set].sort(byPriority) })),
    };
};

/**
 * The notices a stop's board shows. A plain stop shows all of them; a station (`platformCodes` given)
 * shows its own whole, adds a picked platform's, and otherwise `summary` names the platforms holding theirs.
 */
export const boardNotices = (
    infotexts: Infotext[],
    stopIds: string[],
    platformCodes: ReadonlyMap<string, string> | null,
    selectedPlatform: string | null,
): { shown: Infotext[]; summary: PlatformNotices[] } => {
    if (!platformCodes) return { shown: noticesForStops(infotexts, stopIds), summary: [] };
    const { station, platforms } = noticesByPlatform(infotexts, stopIds, platformCodes);
    if (!selectedPlatform) return { shown: station, summary: platforms };
    const own = new Set(station);
    const picked = platforms.find(p => p.code === selectedPlatform)?.notices ?? [];
    return { shown: [...station, ...picked.filter(n => !own.has(n))], summary: [] };
};

/** The most urgent priority among the platforms' notices. */
export const highestPlatformPriority = (platforms: PlatformNotices[]): Infotext['priority'] => {
    let best: Infotext['priority'] = 'low';
    for (const { notices } of platforms) {
        for (const n of notices) if (PRIORITY_RANK[n.priority] < PRIORITY_RANK[best]) best = n.priority;
    }
    return best;
};

/** A notice's text in the UI language: English where the notice has it, Czech otherwise. */
export const noticeText = (info: Infotext, language: string | undefined): string =>
    language === 'en' && info.textEn ? info.textEn : info.text;

/** Notices whose validity window holds `now`; one without an end stays valid. */
export const activeNotices = (notices: Infotext[], now: number): Infotext[] =>
    notices.filter(info => Date.parse(info.valid_from) <= now && (!info.valid_to || Date.parse(info.valid_to) > now));
