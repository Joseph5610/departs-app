export const getVehicleColor = (routeType: string | number, routeName: string): string => {
    const type = String(routeType).toLowerCase();
    const nameStr = String(routeName);

    // 1. Metro Specifics (Priority)
    if (type === '1' || type === 'metro') {
        switch (nameStr.toUpperCase()) {
            case 'A': return '#00A651'; // Zelená
            case 'B': return '#F9B233'; // Žltá
            case 'C': return '#E31E24'; // Červená
        }
    }

    // 2. Night Routes (Trams 90-99, Buses 900+)
    const nameNum = parseInt(nameStr, 10);
    if (!isNaN(nameNum)) {
        if ((nameNum >= 90 && nameNum <= 99) || nameNum >= 900) {
            return '#111827'; // Dark Night
        }
    }

    // 3. Fallback by Type
    switch (type) {
        case '0':
        case 'tram':
            return '#930019'; // Bordová (Tram)
        case '1':
        case 'metro':
            return '#AD0B00'; // Default Metro
        case '11':
        case 'trolleybus':
            return '#A21CAF'; // Fialová (Trolleybus)
        case '3':
        case 'bus':
            return '#005CBF'; // Svetlejšia modrá (Bus)
        case '109':
        case 'train':
            return '#002D5A'; // Tmavo modrá (Vlaky)
        default:
            return '#5A5A5A'; // Šedá pre ostatné
    }
};

// MapLibre expression for the Same Logic
export const vehicleColorExpression: any = [
    'case',
    // 1. Metro Specifics (Priority)
    ['any', ['==', ['get', 'gtfs_route_short_name'], 'A'], ['==', ['get', 'route_short_name'], 'A']], '#00A651',
    ['any', ['==', ['get', 'gtfs_route_short_name'], 'B'], ['==', ['get', 'route_short_name'], 'B']], '#F9B233',
    ['any', ['==', ['get', 'gtfs_route_short_name'], 'C'], ['==', ['get', 'route_short_name'], 'C']], '#E31E24',

    // 2. Night Routes Detection (90-99 or 900+)
    [
        'any',
        ['match', ['to-string', ['coalesce', ['get', 'gtfs_route_short_name'], ['get', 'route_short_name'], '']], ['90', '91', '92', '93', '94', '95', '96', '97', '98', '99'], true, false],
        ['>=', ['to-number', ['coalesce', ['get', 'gtfs_route_short_name'], ['get', 'route_short_name'], '0']], 900]
    ], '#111827',

    // 3. Type-based fallback
    ['match', ['to-string', ['get', 'route_type']],
        '0', '#930019', 'tram', '#930019',
        '1', '#AD0B00', 'metro', '#AD0B00',
        '3', '#005CBF', 'bus', '#005CBF',
        '11', '#A21CAF', 'trolleybus', '#A21CAF',
        '109', '#002D5A', 'train', '#002D5A',
        '#5A5A5A'
    ]
];
