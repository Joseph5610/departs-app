import type { AppAlert } from "../../../../_core/types";
import type { GtfsData, GtfsRoute } from "../../core/gtfs-data";
import { formatDate } from "../../../../_core/api-utils";
import { transit_realtime } from 'gtfs-realtime-bindings';

export class BaseGtfsAlertsMapper {
    
    public mapAlerts(rawAlerts: transit_realtime.IFeedEntity[], gtfsData: GtfsData | null, forceIncident: boolean = false): AppAlert[] {
        return rawAlerts.map((entity) => {
            const alert = entity.alert!;
            const headerStr = alert.headerText?.translation?.[0]?.text || '';
            const isDetour = this.parseIsDetour(alert, headerStr);
            
            const lines: string[] = [];
            const line_metadata: Array<{ name: string; route_color: string; type: string }> = [];

            if (alert.informedEntity) {
                for (const ie of alert.informedEntity) {
                    if (ie.routeId) {
                        lines.push(ie.routeId);
                        
                        let matchingRoute: GtfsRoute | undefined;
                        if (gtfsData) {
                            matchingRoute = gtfsData.routes[ie.routeId] || gtfsData.routesByName[ie.routeId.toUpperCase()];
                        }

                        if (matchingRoute) {
                            line_metadata.push({
                                name: (matchingRoute.short_name || matchingRoute.name) as string,
                                route_color: (matchingRoute.route_color as string) || '#888888',
                                type: String(matchingRoute.type)
                            });
                        } else {
                            line_metadata.push({
                                name: ie.routeId,
                                route_color: '#888888',
                                type: '3'
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

            const rawDesc = alert.descriptionText?.translation?.[0]?.text;
            let description = null;
            if (rawDesc) {
                description = rawDesc
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&nbsp;/g, ' ');
            }
            description = this.parseDescription(description);

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

    protected parseIsDetour(alert: transit_realtime.IAlert, _headerStr: string): boolean {
        void _headerStr;
        return String(alert.effect) === '4' || 
               String(alert.effect) === '9' || 
               String(alert.effect) === 'DETOUR';
    }

    protected parseDescription(rawDesc?: string | null): string | null {
        return rawDesc || null;
    }

    protected parseExtensions(_alert: transit_realtime.IAlert, _appAlert: AppAlert): void {
        void _alert;
        void _appAlert;
    }
}
