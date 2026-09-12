import { transit_realtime } from 'gtfs-realtime-bindings';
import { BaseGtfsAlertsMapper } from '../../../gtfs/services/alerts/BaseGtfsAlertsMapper';
import { AlertTextFormatter } from '../../../../_core/utils/AlertTextFormatter';
import type { AppAlert } from '../../../../_core/types';
import type { GtfsRoutesData, GtfsRoute } from '../../../gtfs/core/gtfs-data';

export class KordisAlertsMapper extends BaseGtfsAlertsMapper {
    public override mapAlerts(rawAlerts: transit_realtime.IFeedEntity[], gtfsData: GtfsRoutesData | null, timezone: string, forceIncident: boolean = false): AppAlert[] {
        const mapped = super.mapAlerts(rawAlerts, gtfsData, timezone, forceIncident);
        
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

    /**
     * KORDIS flattens HTML into one line: paragraph ends become runs of periods (`. .`, `..`, `:.`),
     * headings end with a spaced ` . ` and list items are an inline `•`. Restores them as line breaks.
     */
    private static restoreStructure(text: string): string {
        return text
            .replace(/:\s*\.(?:\s*\.)*\s*/g, ':\n\n')
            .replace(/\.(?:\s*\.)+\s*/g, '.\n\n')
            .replace(/[ \u00a0]+\.[ \u00a0]+/g, '\n')
            .replace(/\s*•\s*/g, '\n• ')
            .replace(/[ \u00a0]{2,}/g, ' ')
            .split('\n')
            .map(line => line.trim())
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
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
        const cleanedDesc = AlertTextFormatter.fromHtml(this.stripTweetPrefix(rawDesc));
        const cleanedHeader = AlertTextFormatter.fromHtml(this.stripTweetPrefix(rawHeader)) || '';

        if (!cleanedDesc) {
            return { title: cleanedHeader, description: null };
        }

        const newlineIndex = cleanedDesc.indexOf('\n');
        if (newlineIndex !== -1) {
            const title = cleanedDesc.slice(0, newlineIndex).trim();
            const description = KordisAlertsMapper.restoreStructure(cleanedDesc.slice(newlineIndex + 1));
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
    private kordisRouteMapCache = new WeakMap<GtfsRoutesData, Map<string, GtfsRoute>>();

    protected resolveRoute(routeId: string, gtfsData: GtfsRoutesData | null): GtfsRoute | undefined {
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
