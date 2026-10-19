import { describe, expect, it } from 'vitest';
import type { RouteInfo, StopsFile } from '@/types';
import { stopCollectionFromFile } from './stopsFile';
import { indexStopsById } from './collections';

const routes: Record<string, RouteInfo> = {
    L991: { name: 'A', type: '1', route_color: '#00A562' },
    L9: { name: '9', type: '0', route_color: '#7A0603' },
    L1300: { name: 'S1', type: '2', route_color: '#251E62' },
};

const file: StopsFile = {
    version: 1,
    stations: [{ id: 'station-U1040S1', name: 'Anděl', pos: [14.4037, 50.071] }],
    platforms: [
        { id: 'U1040Z1P', station: 'station-U1040S1', pos: [14.4036, 50.0719], code: 'A', zones: ['P'], routes: ['L9'] },
        { id: 'U1040Z101P', aliases: ['U1040Z102P'], station: 'station-U1040S1', pos: [14.4039, 50.0695], routes: ['L991', 'L1300'] },
    ],
    entrances: [{ id: 'U1040E1', station: 'station-U1040S1', name: 'Anděl', pos: [14.404, 50.0705] }],
};

const byId = (stationsByPlatforms = false) =>
    new Map(stopCollectionFromFile(file, routes, stationsByPlatforms).features.map(f => [f.properties.stop_id, f.properties]));

describe('stopCollectionFromFile', () => {
    // A station's board, badges and stars cover every platform listed under it, aliases included.
    it('gives a station its platforms ids and the union of their lines', () => {
        expect(byId().get('station-U1040S1')).toMatchObject({
            stop_name: 'Anděl',
            location_type: 1,
            is_station: true,
            zone_id: 'P',
            all_ids: ['U1040Z1P', 'U1040Z101P', 'U1040Z102P'],
            platform_count: 2,
            lines: [{ name: '9', type: 'tram' }, { name: 'A', type: 'metro' }, { name: 'S1', type: 'train' }],
        });
    });

    // Links and favorites saved before stops.json name a merged platform by its comma-joined ids.
    it('keeps a platform with aliases under its comma-joined ids, named after its station', () => {
        expect(byId().get('U1040Z101P,U1040Z102P')).toMatchObject({
            stop_name: 'Anděl',
            location_type: 0,
            all_ids: ['U1040Z101P', 'U1040Z102P'],
            lines: [{ name: 'A', type: 'metro' }, { name: 'S1', type: 'train' }],
        });
        expect(byId().get('U1040Z1P')).toMatchObject({ platform_code: 'A', zone_id: 'P' });
    });

    // Golemio knows no stations: a PID station is asked for as its platforms.
    it('names a station by its platforms ids when the network has no station ids', () => {
        const station = byId(true).get('U1040Z1P,U1040Z101P,U1040Z102P');
        expect(station).toMatchObject({ is_station: true, stop_name: 'Anděl' });
        expect(station?.all_ids?.[0]).toBe('station-U1040S1');
    });

    it('resolves every platform id and alias to its platform, not to the station', () => {
        const index = indexStopsById(stopCollectionFromFile(file, routes));
        expect(index.get('U1040Z102P')?.properties.stop_id).toBe('U1040Z101P,U1040Z102P');
        expect(index.get('U1040Z1P')?.properties.stop_id).toBe('U1040Z1P');
        expect(index.get('station-U1040S1')?.properties.is_station).toBe(true);
    });

    // A terminus kept only for alighting has no departures to open; the map must not draw an empty badge for it.
    it('marks a station whose every platform is alight-only as drop-off only', () => {
        const terminus: StopsFile = {
            version: 1,
            stations: [{ id: 'S', name: 'ZŠ Jana Babáka', pos: [16.59, 49.21] }],
            platforms: [{ id: 'P', station: 'S', pos: [16.59, 49.21], routes: [], alightOnly: true }],
            entrances: [],
        };
        expect(stopCollectionFromFile(terminus, routes).features[0]!.properties.is_drop_off_only).toBe(true);
        expect(byId().get('station-U1040S1')?.is_drop_off_only).toBeUndefined();
    });
});
