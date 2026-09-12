import type { AppAlert, AppRouteType } from "../../../../_core/types";
import type { GtfsRoutesData, GtfsRoute } from "../../core/gtfs-data";
import { formatDate } from "../../../../_core/utils/time";
import { transit_realtime } from 'gtfs-realtime-bindings';
import { normalizeRouteType } from "../../../../_core/utils/routeTypes";
import { AlertTextFormatter } from "../../../../_core/utils/AlertTextFormatter";

export class BaseGtfsAlertsMapper {
    /**
     * Maps raw GTFS-RT feed entities into application-specific AppAlert structures.
     * 
     * This method orchestrates the translation of standard GTFS fields (headers, descriptions, 
     * affected routes, active periods) and delegates to overridable hooks (e.g. `parseContent`, 
     * `parseIsDetour`, `resolveRoute`) to allow city-specific adapters to customize the extraction logic.
     * 
     * @param rawAlerts The array of GTFS-RT feed entities containing alerts.
     * @param gtfsData Static GTFS data used to resolve route names, colors, and types for affected entities.
     * @param forceIncident If true, overrides the detour detection logic and forces the alert type to 'incident'.
     * @returns A mapped array of AppAlert objects ready for frontend consumption.
     */
    public mapAlerts(rawAlerts: transit_realtime.IFeedEntity[], gtfsData: GtfsRoutesData | null, timezone: string, forceIncident: boolean = false): AppAlert[] {
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
                                type: 'unknown'
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
                    valid_from = formatDate(new Date(startMs), timezone);
                }
                if (period.end && Number(period.end) > 0) {
                    const endMs = Number(period.end) * (Number(period.end) > 1e11 ? 1 : 1000);
                    valid_to = formatDate(new Date(endMs), timezone);
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
        return String(alert.effect) === '4' || 
               String(alert.effect) === '9' || 
               String(alert.effect) === 'DETOUR';
    }

    protected parseTitle(rawTitle?: string | null): string {
        if (!rawTitle) return '';
        return AlertTextFormatter.fromHtml(rawTitle) || '';
    }

    protected parseDescription(rawDesc?: string | null): string | null {
        if (!rawDesc) return null;
        return AlertTextFormatter.fromHtml(rawDesc);
    }

    /**
     * Resolves a raw GTFS-RT routeId to GTFS route metadata.
     * Can be overridden by city-specific mappers to handle custom route ID formats.
     */
    protected resolveRoute(routeId: string, gtfsData: GtfsRoutesData | null): GtfsRoute | undefined {
        if (!gtfsData) return undefined;
        return gtfsData.routes[routeId] || gtfsData.routesByName[routeId.toUpperCase()];
    }

    protected parseExtensions(_alert: transit_realtime.IAlert, _appAlert: AppAlert): void {
    }
}

