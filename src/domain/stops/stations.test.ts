import { describe, expect, it } from 'vitest';
import type { StopCollection, StopFeature } from '@/types';
import { groupStations, stopBadgeTiles, stopModeList } from './stations';
import { indexStopsById } from './collections';

const stop = (stop_id: string, properties: Partial<StopFeature['properties']> = {}, coordinates: [number, number] = [14.42, 50.08]): StopFeature => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates },
    properties: { stop_id, stop_name: 'Anděl', location_type: 0, ...properties },
});

const collection = (...features: StopFeature[]): StopCollection => ({ type: 'FeatureCollection', features });

const byId = (stations: StopCollection | null) => new Map(stations?.features.map(f => [f.properties.stop_id, f.properties]));

describe('stopModeList', () => {
    // Networks write a line's mode as a name (PID) or a GTFS code (IDS JMK, DPMP); both must give one badge order.
    it('normalizes named and GTFS-coded modes into ROUTE_TYPE_ORDER without duplicates', () => {
        expect(stopModeList({
            lines: [
                { name: '9', type: '3' as never, route_color: '' },
                { name: '25', type: 'trolleybus', route_color: '' },
                { name: '1', type: '0' as never, route_color: '' },
                { name: '2', type: 'tram', route_color: '' },
            ],
            metro_lines: [{ name: 'B', route_color: '#F8B322' }],
        })).toEqual(['metro', 'tram', 'trolleybus', 'bus']);
    });
});

describe('stopBadgeTiles', () => {
    // A transfer station shows each metro line in its own colour, as on PID signage.
    it('splits metro into one tile per line, in line order, ahead of the other modes', () => {
        expect(stopBadgeTiles({
            lines: [{ name: '9', type: 'tram', route_color: '' }],
            metro_lines: [{ name: 'C', route_color: '#CF003D' }, { name: 'A', route_color: '#00A562' }],
        })).toBe('metro/A/00A562|metro/C/CF003D|tram');
    });
});

describe('groupStations', () => {
    // IDS JMK, DPMP and DÚK name the parent; its id opens the whole station's board.
    it('groups platforms under their parent station id', () => {
        const stations = groupStations(collection(
            stop('Z1', { parent_station: 'N1', lines: [{ name: '1', type: '0' as never, route_color: '' }] }),
            stop('Z2', { parent_station: 'N1', lines: [{ name: '61', type: '3' as never, route_color: '' }] }),
        ));
        expect(stations?.features).toHaveLength(1);
        expect(stations?.features[0].properties).toMatchObject({ stop_id: 'N1', badges: 'tram|bus', all_ids: ['Z1', 'Z2'] });
    });

    // PID lists no parents: same-named platforms nearby are one station, joined ids are one board.
    it('joins nearby same-named platforms of a network without parents, and keeps a far namesake apart', () => {
        const stations = groupStations(collection(
            stop('U1040Z1P', { lines: [{ name: '9', type: 'tram', route_color: '' }] }, [14.4036, 50.0719]),
            stop('U1040Z101P,U1040Z102P', { location_type: 1, metro_lines: [{ name: 'B', route_color: '#F8B322' }] }, [14.4039, 50.0695]),
            stop('U9999Z1P', { lines: [{ name: '301', type: 'bus', route_color: '' }] }, [14.9, 50.3]),
        ));
        const props = byId(stations);
        expect(props.get('U1040Z1P,U1040Z101P,U1040Z102P')).toMatchObject({ badges: 'metro/B/F8B322|tram', all_ids: ['U1040Z1P', 'U1040Z101P', 'U1040Z102P'] });
        expect(props.get('U9999Z1P')).toMatchObject({ badges: 'bus' });
    });

    it('leaves entrances out', () => {
        expect(groupStations(collection(stop('E1', { location_type: 2 })))?.features).toEqual([]);
    });

    // A joined station id is not in the stop list, yet the board it opens needs the station's name and lines.
    it('makes a joined station id resolvable without displacing the platforms', () => {
        const platformA = stop('U1Z1P');
        const platformB = stop('U1Z2P');
        const stops = collection(platformA, platformB);
        const index = indexStopsById(stops, groupStations(stops));
        expect(index.get('U1Z1P,U1Z2P')?.properties.stop_name).toBe('Anděl');
        expect(index.get('U1Z1P')).toBe(platformA);
    });
});
