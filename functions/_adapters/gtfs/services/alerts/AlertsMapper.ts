import type { AppAlert } from "../../../../_core/types";
import type { GtfsAlertEntity } from "./types";
import type { GtfsRoute } from "../../core/gtfs-data";
import { formatDate } from "../../../../_core/api-utils";

export class AlertsMapper {
    static mapAlerts(rawAlerts: GtfsAlertEntity[], routes: Record<string, unknown>, forceIncident: boolean = false): AppAlert[] {
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

            let causeDetail: { cs?: string, en?: string } | undefined = undefined;
            if (alert.causeDetail?.translation) {
                causeDetail = {};
                for (const t of alert.causeDetail.translation) {
                    if (t.language?.startsWith('cs')) {
                        causeDetail.cs = t.text;
                    } else if (t.language?.startsWith('en')) {
                        causeDetail.en = t.text;
                    }
                }
                if (!causeDetail.cs && alert.causeDetail.translation.length > 0) {
                    causeDetail.cs = alert.causeDetail.translation[0].text;
                }
            }

            return {
                type: (isDetour && !forceIncident) ? 'exclusion' : 'incident',
                title: alert.headerText?.translation?.[0]?.text || 'Mimořádnost',
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
                causeDetail: causeDetail
            };
        });
    }
}
