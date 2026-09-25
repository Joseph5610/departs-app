import type { AppAlert, AppRouteType } from "../../../_core/types";
import type { GtfsRoutesData, GtfsRoute } from "../../../_feeds/gtfs/gtfs-data";
import * as GtfsRt from '../../../_core/gtfsRtTypes';
import { normalizeRouteType } from "../../../_core/utils/routeTypes";
import { AlertTextFormatter } from "../../../_core/utils/AlertTextFormatter";

/** What every network's alerts feed answers `/api/[city]/alerts` with. */
export interface AlertsMapper {
    mapAlerts(rawAlerts: GtfsRt.IFeedEntity[], gtfsData: GtfsRoutesData | null, forceIncident?: boolean): AppAlert[];
}

/**
 * Where a network's alerts differ from the GTFS-RT default: how the header/description text is
 * read, what counts as a detour, how a route id resolves, and any extra fields on the entity.
 */
export interface AlertsMapperHooks {
    parseContent?(rawHeader?: string | null, rawDesc?: string | null): { title: string; description: string | null };
    parseIsDetour?(alert: GtfsRt.IAlert, headerStr: string, rawHeader?: string | null, rawDesc?: string | null): boolean;
    resolveRoute?(routeId: string, gtfsData: GtfsRoutesData | null): GtfsRoute | undefined;
    parseExtensions?(alert: GtfsRt.IAlert, appAlert: AppAlert): void;
}

export function parseTitle(rawTitle?: string | null): string {
    if (!rawTitle) return '';
    return AlertTextFormatter.fromHtml(rawTitle) || '';
}

export function parseDescription(rawDesc?: string | null): string | null {
    if (!rawDesc) return null;
    return AlertTextFormatter.fromHtml(rawDesc);
}

export function defaultParseContent(rawHeader?: string | null, rawDesc?: string | null): { title: string; description: string | null } {
    return { title: parseTitle(rawHeader), description: parseDescription(rawDesc) };
}

export function defaultParseIsDetour(alert: GtfsRt.IAlert): boolean {
    return String(alert.effect) === '4' ||
        String(alert.effect) === '9' ||
        String(alert.effect) === 'DETOUR';
}

/** Resolves a raw GTFS-RT routeId to GTFS route metadata. */
export function defaultResolveRoute(routeId: string, gtfsData: GtfsRoutesData | null): GtfsRoute | undefined {
    if (!gtfsData) return undefined;
    return gtfsData.routes[routeId] || gtfsData.routesByName[routeId.toUpperCase()];
}

/**
 * Maps raw GTFS-RT feed entities into application-specific AppAlert structures.
 *
 * Orchestrates the translation of standard GTFS fields (headers, descriptions, affected routes,
 * active periods); `hooks` let a network customize content parsing, detour detection, route
 * resolution and extra fields without forking the whole method.
 */
export function mapGtfsAlerts(
    rawAlerts: GtfsRt.IFeedEntity[],
    gtfsData: GtfsRoutesData | null,
    forceIncident: boolean = false,
    hooks: AlertsMapperHooks = {}
): AppAlert[] {
    const parseContent = hooks.parseContent ?? defaultParseContent;
    const parseIsDetour = hooks.parseIsDetour ?? ((alert) => defaultParseIsDetour(alert));
    const resolveRoute = hooks.resolveRoute ?? defaultResolveRoute;
    const parseExtensions = hooks.parseExtensions;

    return rawAlerts.map((entity) => {
        const alert = entity.alert!;
        const rawHeader = alert.headerText?.translation?.[0]?.text || '';
        const rawDesc = alert.descriptionText?.translation?.[0]?.text;
        const { title: headerStr, description } = parseContent(rawHeader, rawDesc);
        const isDetour = parseIsDetour(alert, headerStr, rawHeader, rawDesc);

        const lines: string[] = [];
        const line_metadata: Array<{ name: string; type: AppRouteType }> = [];

        if (alert.informedEntity) {
            for (const ie of alert.informedEntity) {
                if (ie.routeId) {
                    const matchingRoute = resolveRoute(ie.routeId, gtfsData);
                    const lineDisplayName = (matchingRoute?.short_name || matchingRoute?.name || ie.routeId) as string;
                    lines.push(lineDisplayName);
                    line_metadata.push({
                        name: lineDisplayName,
                        type: matchingRoute ? normalizeRouteType(matchingRoute.type) : 'unknown'
                    });
                }
            }
        }

        const uniqueLines = [...new Set(lines)];

        const seenMeta = new Set<string>();
        const uniqueMetadata = line_metadata.filter(meta => {
            if (seenMeta.has(meta.name)) return false;
            seenMeta.add(meta.name);
            return true;
        });

        let valid_from: string | null = null;
        let valid_to: string | null = null;

        if (alert.activePeriod && alert.activePeriod.length > 0) {
            const period = alert.activePeriod[0];
            if (period.start && Number(period.start) > 0) {
                const startMs = Number(period.start) * (Number(period.start) > 1e11 ? 1 : 1000);
                valid_from = new Date(startMs).toISOString();
            }
            if (period.end && Number(period.end) > 0) {
                const endMs = Number(period.end) * (Number(period.end) > 1e11 ? 1 : 1000);
                valid_to = new Date(endMs).toISOString();
            }
        }

        const appAlert: AppAlert = {
            type: (isDetour && !forceIncident) ? 'exclusion' : 'incident',
            title: headerStr,
            description: description,
            link: alert.url?.translation?.[0]?.text || '',
            valid_from: valid_from,
            valid_to: valid_to,
            guid: entity.id,
            priority: 'normal',
            lines: uniqueLines.length > 0 ? uniqueLines : undefined,
            line_metadata: uniqueMetadata.length > 0 ? uniqueMetadata : undefined,
            isActive: true,
            isFuture: false,
            cause: alert.cause ? String(alert.cause) : undefined,
            effect: alert.effect ? String(alert.effect) : undefined
        };

        parseExtensions?.(alert, appAlert);

        return appAlert;
    });
}

/** The default GTFS-RT alerts mapper, or one customized by `hooks` for a specific network. */
export function createGtfsAlertsMapper(hooks: AlertsMapperHooks = {}): AlertsMapper {
    return {
        mapAlerts: (rawAlerts, gtfsData, forceIncident = false) => mapGtfsAlerts(rawAlerts, gtfsData, forceIncident, hooks)
    };
}
