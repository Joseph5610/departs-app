import type { AppVehicleState } from '../../../_core/types';

export const DUK_STATE_MAPPING: Record<number, AppVehicleState> = {
    255: 'off_track',            // Vypnuto
    0: 'on_track',               // V jízdě
    1: 'at_stop',                // V zastávce/stanici
    2: 'before_track',           // Čeká před jízdou
    3: 'before_track'            // V jízdě na první zastávku
};

export const DUK_TRACTION_MAPPING: Record<number, string> = {
    1: 'tram',
    2: 'trolleybus',
    3: 'bus',
    5: 'train',
    6: 'ferry'
};

import type { AppRouteType } from '../../../_core/types';

/**
 * Maps a generic string line name to a standard slug route_type ('tram', 'train', 'bus', 'trolleybus').
 */
export function getDukRouteTypeFromLineName(lineName: string): AppRouteType {
    if (/^U\d+/.test(lineName) || /^R\d+/.test(lineName) || /^Os/.test(lineName)) {
        return 'train';
    } else if (lineName === '1' || lineName === '2' || lineName === '3' || lineName === '4') {
        return 'tram'; // (Wait, actually Usti trams don't exist anymore, but we'll leave it for legacy)
    } else if (/^\d{2}$/.test(lineName) && parseInt(lineName, 10) >= 50 && parseInt(lineName, 10) <= 69) {
        return 'trolleybus'; // (rough guess for Usti)
    }
    return 'bus'; // default
}
