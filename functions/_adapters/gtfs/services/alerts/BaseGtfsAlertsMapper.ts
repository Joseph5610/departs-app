import type { AppAlert, AppRouteType } from "../../../../_core/types";
import type { GtfsData, GtfsRoute } from "../../core/gtfs-data";
import { formatDate } from "../../../../_core/api-utils";
import { transit_realtime } from 'gtfs-realtime-bindings';
import { normalizeRouteType } from "../../../../_core/utils/routeTypes";

const HTML_ENTITY_MAP: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'"
};

/**
 * Cleans GTFS alert text by stripping HTML tags while preserving line breaks.
 * Converts <br>, block elements (<p>, <div>, <li>, etc.), \t, and existing newlines
 * into formatted line breaks, strips all remaining HTML tags, and decodes HTML entities.
 */
export function cleanAlertText(text: string | null | undefined): string | null {
    if (!text) return null;

    const cleaned = text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi, '\n')
        .replace(/<(p|div|li|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/gi, (match) => HTML_ENTITY_MAP[match.toLowerCase()] || match)
        .replace(/[\r\t]+/g, '\n');

    const lines = cleaned.split('\n').map(l => l.trim());
    const resultLines: string[] = [];
    let previousWasEmpty = false;

    for (const line of lines) {
        if (line === '') {
            if (!previousWasEmpty) {
                resultLines.push('');
                previousWasEmpty = true;
            }
        } else {
            resultLines.push(line);
            previousWasEmpty = false;
        }
    }

    const result = resultLines.join('\n').trim();
    return result || null;
}

export class BaseGtfsAlertsMapper {
    
    public mapAlerts(rawAlerts: transit_realtime.IFeedEntity[], gtfsData: GtfsData | null, forceIncident: boolean = false): AppAlert[] {
        return rawAlerts.map((entity) => {
            const alert = entity.alert!;
            const rawHeader = alert.headerText?.translation?.[0]?.text || '';
            const rawDesc = alert.descriptionText?.translation?.[0]?.text;
            const { title: headerStr, description } = this.parseContent(rawHeader, rawDesc);
            const isDetour = this.parseIsDetour(alert, headerStr, rawHeader, rawDesc);
            
            const lines: string[] = [];
            const line_metadata: Array<{ name: string; route_color: string; type: AppRouteType }> = [];

            if (alert.informedEntity) {
                for (const ie of alert.informedEntity) {
                    if (ie.routeId) {
                        const matchingRoute = this.resolveRoute(ie.routeId, gtfsData);
                        const lineDisplayName = (matchingRoute?.short_name || matchingRoute?.name || ie.routeId) as string;
                        lines.push(lineDisplayName);

                        if (matchingRoute) {
                            line_metadata.push({
                                name: lineDisplayName,
                                route_color: (matchingRoute.route_color as string) || '#888888',
                                type: normalizeRouteType(matchingRoute.type)
                            });
                        } else {
                            line_metadata.push({
                                name: lineDisplayName,
                                route_color: '#888888',
                                type: 'bus'
                            });
                        }
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
                    valid_from = formatDate(new Date(startMs));
                }
                if (period.end && Number(period.end) > 0) {
                    const endMs = Number(period.end) * (Number(period.end) > 1e11 ? 1 : 1000);
                    valid_to = formatDate(new Date(endMs));
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

            this.parseExtensions(alert, appAlert);

            return appAlert;
        });
    }

    /** Overridable hooks for city-specific logic */
    protected parseContent(rawHeader?: string | null, rawDesc?: string | null): { title: string; description: string | null } {
        const title = this.parseTitle(rawHeader);
        const description = this.parseDescription(rawDesc);
        return { title, description };
    }

    protected parseIsDetour(alert: transit_realtime.IAlert, _headerStr: string, _rawHeader?: string, _rawDesc?: string | null): boolean {
        void _headerStr;
        void _rawHeader;
        void _rawDesc;
        return String(alert.effect) === '4' || 
               String(alert.effect) === '9' || 
               String(alert.effect) === 'DETOUR';
    }

    protected parseTitle(rawTitle?: string | null): string {
        if (!rawTitle) return '';
        return cleanAlertText(rawTitle) || '';
    }

    protected parseDescription(rawDesc?: string | null): string | null {
        if (!rawDesc) return null;
        return cleanAlertText(rawDesc);
    }

    /**
     * Resolves a raw GTFS-RT routeId to GTFS route metadata.
     * Can be overridden by city-specific mappers to handle custom route ID formats.
     */
    protected resolveRoute(routeId: string, gtfsData: GtfsData | null): GtfsRoute | undefined {
        if (!gtfsData) return undefined;
        return gtfsData.routes[routeId] || gtfsData.routesByName[routeId.toUpperCase()];
    }

    protected parseExtensions(_alert: transit_realtime.IAlert, _appAlert: AppAlert): void {
        void _alert;
        void _appAlert;
    }
}

