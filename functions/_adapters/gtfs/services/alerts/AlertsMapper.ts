import type { AppRSSItem } from "../../../../_core/types";
import type { GtfsAlertEntity } from "./types";
import type { GtfsRoute } from "../../core/gtfs-data";

export class AlertsMapper {
    static mapAlerts(rawAlerts: GtfsAlertEntity[], routes: Record<string, unknown>): AppRSSItem[] {
        const routesByName = new Map<string, GtfsRoute>();
        for (const r of Object.values(routes)) {
            const staticRoute = r as GtfsRoute;
            if (staticRoute.name) {
                routesByName.set(staticRoute.name, staticRoute);
            }
        }

        return rawAlerts.map((entity) => {
            const alert = entity.alert!;
            const headerStr = alert.headerText?.translation?.[0]?.text || '';
            const isDetour = 
                String(alert.effect) === '4' || // DETOUR
                String(alert.effect) === '9' || // STOP_MOVED
                alert.effect === 'DETOUR' ||
                headerStr.toLowerCase().includes('výluka');
            
            const lines: string[] = [];
            const line_metadata: Array<{ name: string; route_color: string; type: string }> = [];

            if (alert.informedEntity) {
                for (const ie of alert.informedEntity) {
                    if (ie.routeId) {
                        lines.push(ie.routeId);
                        const matchingRoute = routesByName.get(ie.routeId);
                        if (matchingRoute) {
                            line_metadata.push({
                                name: matchingRoute.name as string,
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
            const uniqueMetadata = line_metadata.filter((meta, index, self) =>
                index === self.findIndex((m) => m.name === meta.name)
            );

            const rawDesc = alert.descriptionText?.translation?.[0]?.text;
            let description = null;
            if (rawDesc) {
                description = rawDesc
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&nbsp;/g, ' ');
            }

            return {
                type: isDetour ? 'exclusion' : 'incident',
                title: alert.headerText?.translation?.[0]?.text || 'Mimořádnost',
                description: description,
                link: alert.url?.translation?.[0]?.text || 'https://www.idsjmk.cz',
                valid_from: null,
                valid_to: null,
                guid: entity.id,
                priority: 'normal',
                lines: uniqueLines.length > 0 ? uniqueLines : undefined,
                line_metadata: uniqueMetadata.length > 0 ? uniqueMetadata : undefined,
                isActive: true,
                isFuture: false
            };
        });
    }
}
