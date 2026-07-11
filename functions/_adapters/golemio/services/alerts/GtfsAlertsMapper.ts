import { transit_realtime } from 'gtfs-realtime-bindings';
import { BaseGtfsAlertsMapper } from '../../../gtfs/services/alerts/BaseGtfsAlertsMapper';
import type { AppAlert } from '../../../../_core/types';

export interface PidAlertExtension {
    causeDetail?: { translation?: Array<{ text: string, language?: string }> };
}

export class GtfsAlertsMapper extends BaseGtfsAlertsMapper {
    protected parseExtensions(alert: transit_realtime.IAlert, appAlert: AppAlert): void {
        const customAlert = alert as transit_realtime.IAlert & PidAlertExtension;
        
        if (customAlert.causeDetail?.translation) {
            const causeDetail: { cs?: string, en?: string } = {};
            for (const t of customAlert.causeDetail.translation) {
                if (t.language?.startsWith('cs')) {
                    causeDetail.cs = t.text;
                } else if (t.language?.startsWith('en')) {
                    causeDetail.en = t.text;
                }
            }
            if (!causeDetail.cs && customAlert.causeDetail.translation.length > 0) {
                causeDetail.cs = customAlert.causeDetail.translation[0].text;
            }
            appAlert.causeDetail = causeDetail;
        }
    }
}
