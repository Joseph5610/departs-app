import type { FeatureCollection, Point } from 'geojson';
import type { RSSItem } from '@/types';
import { isHighPriorityAlert } from './lists';

/** The picture an alert is drawn with, in the list and on the map. */
export type AlertIconKind =
    | 'noService' | 'reducedService' | 'delays' | 'detour' | 'addedService' | 'stopMoved'
    | 'maintenance' | 'protest' | 'accident' | 'holiday' | 'weather' | 'construction' | 'police' | 'medical' | 'warning';

const KIND_BY_EFFECT: Record<string, AlertIconKind | undefined> = {
    '1': 'noService', '2': 'reducedService', '3': 'delays', '4': 'detour', '5': 'addedService', '9': 'stopMoved',
};

const KIND_BY_CAUSE: Record<string, AlertIconKind | undefined> = {
    '3': 'maintenance', '9': 'maintenance', '4': 'protest', '5': 'protest', '6': 'accident', '7': 'holiday',
    '8': 'weather', '10': 'construction', '11': 'police', '12': 'medical',
};

/** An alert's icon: by its GTFS-RT effect, else its cause, else roadworks for an exclusion and a warning sign for the rest. */
export const alertIconKind = (cause?: string, effect?: string, type?: string): AlertIconKind =>
    (effect && KIND_BY_EFFECT[effect]) || (cause && KIND_BY_CAUSE[cause]) || (type === 'exclusion' ? 'construction' : 'warning');

export interface AlertMapProps {
    guid: string;
    title: string;
    kind: AlertIconKind;
    tone: 'high' | 'normal';
}

/** The placed alerts in force now, as map points; planned ones stay in the alerts list only. */
export function alertMapPoints(alerts: readonly RSSItem[]): FeatureCollection<Point, AlertMapProps> {
    const features: FeatureCollection<Point, AlertMapProps>['features'] = [];
    for (const alert of alerts) {
        if (!alert.location || !alert.guid || !alert.isActive) continue;
        features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [alert.location.lon, alert.location.lat] },
            properties: {
                guid: alert.guid,
                title: alert.title,
                kind: alertIconKind(alert.cause, alert.effect, alert.type),
                tone: isHighPriorityAlert(alert.priority) ? 'high' : 'normal',
            },
        });
    }
    return { type: 'FeatureCollection', features };
}
