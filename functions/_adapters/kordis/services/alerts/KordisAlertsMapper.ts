import { transit_realtime } from 'gtfs-realtime-bindings';
import { BaseGtfsAlertsMapper } from '../../../gtfs/services/alerts/BaseGtfsAlertsMapper';
import type { AppAlert } from '../../../../_core/types';
import type { GtfsData, GtfsRoute } from '../../../gtfs/core/gtfs-data';

export class KordisAlertsMapper extends BaseGtfsAlertsMapper {
    public mapAlerts(rawAlerts: transit_realtime.IFeedEntity[], gtfsData: GtfsData | null, forceIncident: boolean = false): AppAlert[] {
        const mapped = super.mapAlerts(rawAlerts, gtfsData, forceIncident);
        
        // Sort Kordis alerts by newest ID first (descending numeric ID)
        return mapped.sort((a, b) => this.extractNumericId(b.guid) - this.extractNumericId(a.guid));
    }

    private extractNumericId(guid?: string): number {
        if (!guid) return 0;
        const match = guid.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
    }

    private stripTweetPrefix(text?: string | null): string | null {
        if (!text) return null;
        return text.startsWith('TWEET:') ? text.slice(6).trim() : text.trim();
    }

    protected parseIsDetour(alert: transit_realtime.IAlert, headerStr: string, rawHeader?: string, rawDesc?: string | null): boolean {
        const isTweet = Boolean(
            (rawHeader && rawHeader.toUpperCase().includes('TWEET')) || 
            (rawDesc && rawDesc.toUpperCase().includes('TWEET:'))
        );
        if (isTweet) {
            return false;
        }

        if (super.parseIsDetour(alert, headerStr, rawHeader, rawDesc)) {
            return true;
        }
        
        const combinedText = `${rawHeader || ''} ${headerStr} ${rawDesc || ''}`.toLowerCase();
        return combinedText.includes('výluka');
    }

    protected parseContent(rawHeader?: string | null, rawDesc?: string | null): { title: string; description: string | null } {
        const cleanedDesc = BaseGtfsAlertsMapper.cleanAlertText(this.stripTweetPrefix(rawDesc));
        const cleanedHeader = BaseGtfsAlertsMapper.cleanAlertText(this.stripTweetPrefix(rawHeader)) || '';

        if (!cleanedDesc) {
            return { title: cleanedHeader, description: null };
        }

        const newlineIndex = cleanedDesc.indexOf('\n');
        if (newlineIndex !== -1) {
            const title = cleanedDesc.slice(0, newlineIndex).trim();
            const description = cleanedDesc.slice(newlineIndex + 1).trim();
            return {
                title: title || cleanedHeader,
                description: description || null
            };
        }

        return {
            title: cleanedDesc,
            description: null
        };
    }

    /**
     * Resolves a raw GTFS-RT routeId to GTFS route metadata.
     * Overrides base implementation to handle Kordis-specific route ID formatting:
     * Real-time feeds pass numeric IDs like "120", whereas static GTFS routes keys use "L120D99".
     */
    private kordisRouteMapCache = new WeakMap<GtfsData, Map<string, GtfsRoute>>();

    protected resolveRoute(routeId: string, gtfsData: GtfsData | null): GtfsRoute | undefined {
        const standard = super.resolveRoute(routeId, gtfsData);
        if (standard || !gtfsData) return standard;

        let map = this.kordisRouteMapCache.get(gtfsData);
        if (!map) {
            map = new Map<string, GtfsRoute>();
            for (const key in gtfsData.routes) {
                // GTFS key format: "L120D99" -> shortId = "120"
                const match = /^L([A-Z0-9]+)D/i.exec(key);
                if (match) {
                    map.set(match[1].toUpperCase(), gtfsData.routes[key]);
                }
            }
            this.kordisRouteMapCache.set(gtfsData, map);
        }

        return map.get(routeId.toUpperCase());
    }
}
