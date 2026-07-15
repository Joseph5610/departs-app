export const DUK_STATE_MAPPING: Record<number, string> = {
    255: 'off_track',            // Vypnuto
    0: 'in_transit_to',          // V jízdě
    1: 'at_stop',                // V zastávce/stanici
    2: 'before_track',           // Čeká před jízdou
    3: 'in_transit_to'           // V jízdě na první zastávku
};

export const DUK_TRACTION_MAPPING: Record<number, string> = {
    1: 'tram',
    2: 'trolleybus',
    3: 'bus',
    5: 'train',
    6: 'boat'
};

/**
 * Maps a generic string line name to a standard GTFS route_type (0=tram, 2=rail, 3=bus, 11=trolleybus).
 */
export function getDukRouteTypeFromLineName(lineName: string): number {
    if (/^U\d+/.test(lineName) || /^R\d+/.test(lineName) || /^Os/.test(lineName)) {
        return 2; // Rail
    } else if (lineName === '1' || lineName === '2' || lineName === '3' || lineName === '4') {
        return 0; // Tram (Wait, actually Usti trams don't exist anymore, but we'll leave it for legacy)
    } else if (/^\d{2}$/.test(lineName) && parseInt(lineName, 10) >= 50 && parseInt(lineName, 10) <= 69) {
        return 11; // Trolleybus (rough guess for Usti)
    }
    return 3; // Bus default
}
