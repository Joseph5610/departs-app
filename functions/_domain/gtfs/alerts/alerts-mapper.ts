import type { AppAlert } from "../../../_core/types";
import * as GtfsRt from '../../../_core/gtfsRtTypes';
import { AlertTextFormatter } from "../../../_core/utils/AlertTextFormatter";

/** What every network's alerts feed answers `/api/[city]/alerts` with. */
export interface AlertsMapper {
    mapAlerts(rawAlerts: GtfsRt.IFeedEntity[], forceIncident?: boolean): AppAlert[];
}

/**
 * Where a network's alerts differ from the GTFS-RT default: how the header/description text is
 * read, what counts as a detour, and any extra fields on the entity.
 */
export interface AlertsMapperHooks {
    parseContent?(rawHeader?: string | null, rawDesc?: string | null): { title: string; description: string | null };
    parseIsDetour?(alert: GtfsRt.IAlert, headerStr: string, rawHeader?: string | null, rawDesc?: string | null): boolean;
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

/**
 * Maps raw GTFS-RT feed entities into application-specific AppAlert structures.
 *
 * Orchestrates the translation of standard GTFS fields (headers, descriptions, affected routes,
 * active periods); `hooks` let a network customize content parsing, detour detection and extra
 * fields without forking the whole method. Affected routes are sent as raw `route_id`s - the
 * frontend resolves name/type/color itself from the same static file it already joins vehicles
 * and departures against.
 */
export function mapGtfsAlerts(
    rawAlerts: GtfsRt.IFeedEntity[],
    forceIncident: boolean = false,
    hooks: AlertsMapperHooks = {}
): AppAlert[] {
    const parseContent = hooks.parseContent ?? defaultParseContent;
    const parseIsDetour = hooks.parseIsDetour ?? ((alert) => defaultParseIsDetour(alert));
    const parseExtensions = hooks.parseExtensions;

    return rawAlerts.map((entity) => {
        const alert = entity.alert!;
        const rawHeader = alert.headerText?.translation?.[0]?.text || '';
        const rawDesc = alert.descriptionText?.translation?.[0]?.text;
        const { title: headerStr, description } = parseContent(rawHeader, rawDesc);
        const isDetour = parseIsDetour(alert, headerStr, rawHeader, rawDesc);

        const routeIds = new Set<string>();
        if (alert.informedEntity) {
            for (const ie of alert.informedEntity) {
                if (ie.routeId) routeIds.add(ie.routeId);
            }
        }
        const line_metadata = [...routeIds].map(route_id => ({ route_id }));

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
            line_metadata: line_metadata.length > 0 ? line_metadata : undefined,
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
        mapAlerts: (rawAlerts, forceIncident = false) => mapGtfsAlerts(rawAlerts, forceIncident, hooks)
    };
}
