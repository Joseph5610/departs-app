export const getVehicleColor = (routeType: string, routeName: string): string => {
    switch (routeType) {
        case 'tram':
            return '#930019'; // Bordová (Tram)
        case 'trolleybus':
            return '#A21CAF'; // Fialová (Trolleybus)
        case 'bus':
            return '#005CBF'; // Svetlejšia modrá (Bus)
        case 'metro':
            switch (routeName?.toUpperCase()) {
                case 'A': return '#00A651'; // Zelená
                case 'B': return '#F9B233'; // Žltá
                case 'C': return '#E31E24'; // Červená
                default: return '#AD0B00'; // Default Metro
            }
        case 'train':
            return '#002D5A'; // Tmavo modrá (Vlaky)
        default:
            return '#5A5A5A'; // Šedá pre ostatné
    }
};

// MapLibre expression for the Same Logic - robustly handles string IDs and names
export const vehicleColorExpression: any = [
    'case',
    // Metro Specifics
    ['any', ['==', ['get', 'gtfs_route_short_name'], 'A'], ['==', ['get', 'route_short_name'], 'A']], '#00A651',
    ['any', ['==', ['get', 'gtfs_route_short_name'], 'B'], ['==', ['get', 'route_short_name'], 'B']], '#F9B233',
    ['any', ['==', ['get', 'gtfs_route_short_name'], 'C'], ['==', ['get', 'route_short_name'], 'C']], '#E31E24',

    // Type-based fallback
    ['match', ['to-string', ['get', 'route_type']],
        ['0', 'tram'], '#930019',      // Tram
        ['1', 'metro'], '#AD0B00',     // Metro generic
        ['3', 'bus'], '#005CBF',       // Bus
        ['11', 'trolleybus'], '#A21CAF', // Trolleybus
        ['109', 'train'], '#002D5A',   // Train
        '#5A5A5A' // default
    ]
];
