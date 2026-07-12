import { transit_realtime } from 'gtfs-realtime-bindings';
import { BaseGtfsAlertsMapper } from '../../../gtfs/services/alerts/BaseGtfsAlertsMapper';

export class KordisAlertsMapper extends BaseGtfsAlertsMapper {
    protected parseIsDetour(alert: transit_realtime.IAlert, headerStr: string): boolean {
        return super.parseIsDetour(alert, headerStr) || headerStr.toLowerCase().includes('výluka');
    }

    protected parseDescription(rawDesc?: string | null): string | null {
        if (!rawDesc) return null;
        return rawDesc.startsWith('TWEET:') ? rawDesc.replace('TWEET:', '').trim() : rawDesc;
    }
}
