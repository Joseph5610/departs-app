import { describe, expect, it } from 'vitest';
import { ROUTES, stopModel, stopsFile } from '@/test/factories';
import { boardStopIds, buildStopModel, departureStopIds, departuresRequestId, isStationBoard, platformCodes, resolveStop, selectStop } from './model';

/** Anděl as PID publishes it: a tram platform, a metro platform merged from two ids, an entrance. */
const andel = () => stopModel([{
    id: 'U1040-1',
    name: 'Anděl',
    platforms: [
        { id: 'U1040Z1P', code: 'A', zones: ['P'], routes: ['T9'] },
        { id: 'U1040Z101P', aliases: ['U1040Z102P'], routes: ['MB', 'T9'] },
    ],
}], [{ id: 'U1040E1', station: 'U1040-1', name: 'Anděl', pos: [14.404, 50.0705] }]);

describe('buildStopModel', () => {
    // A station's board, badges and stars cover every platform listed under it.
    it('gives a station its platforms and the union of their lines', () => {
        const station = andel().stations[0]!;
        expect(station.platforms.map(p => p.id)).toEqual(['U1040Z1P', 'U1040Z101P']);
        expect(station.lines.map(l => [l.name, l.type])).toEqual([['9', 'tram'], ['B', 'metro']]);
    });

    it('names each platform after its station and keeps its code, zones aside', () => {
        expect(andel().platforms[0]).toMatchObject({ kind: 'platform', name: 'Anděl', station: 'U1040-1', code: 'A' });
    });

    it('resolves every platform id and alias to its platform, and the station id to the station', () => {
        const { byId } = andel();
        expect(byId.get('U1040Z102P')?.id).toBe('U1040Z101P');
        expect(byId.get('U1040-1')?.kind).toBe('station');
        expect(byId.get('U1040E1')).toBeUndefined();
    });

    // A terminus kept only for alighting has no departures to open; the map must not draw an empty badge for it.
    it('marks a station whose every platform is alight-only', () => {
        const model = buildStopModel(stopsFile([{ id: 'S', platforms: [{ id: 'P', alightOnly: true }] }]), ROUTES);
        expect(model.stations[0]!.alightOnly).toBe(true);
        expect(andel().stations[0]!.alightOnly).toBeUndefined();
    });
});

describe('resolveStop', () => {
    it('opens a station, or a platform by its id or an alias', () => {
        expect(resolveStop(andel(), 'U1040-1')).toMatchObject({ kind: 'station', id: 'U1040-1', name: 'Anděl' });
        expect(resolveStop(andel(), 'U1040Z102P')).toMatchObject({ kind: 'platform', id: 'U1040Z101P' });
    });

    // Links and favorites saved before stops.json name a PID station by its platforms and a merged platform by both its ids.
    it('reads a pre-stops.json PID id as the stop it named', () => {
        expect(resolveStop(andel(), 'U1040Z1P,U1040Z101P,U1040Z102P')).toMatchObject({ kind: 'station', id: 'U1040-1' });
        expect(resolveStop(andel(), 'U1040Z101P,U1040Z102P')).toMatchObject({ kind: 'platform', id: 'U1040Z101P' });
    });

    // A board section opens every platform it shows as one stop.
    it('opens a list of some of a station\'s platforms as a section', () => {
        const model = stopModel([{ id: 'S', platforms: [{ id: 'P1', direction: 'Grohova' }, { id: 'P2', direction: 'Grohova' }, { id: 'P3', code: 'A' }] }]);
        expect(resolveStop(model, 'P1,P2')).toMatchObject({ kind: 'section', id: 'P1,P2', name: 'S', platforms: [{ id: 'P1' }, { id: 'P2' }] });
    });

    it('is null for an id the model does not know', () => {
        expect(resolveStop(andel(), 'X9')).toBeNull();
    });
});

describe('departuresRequestId', () => {
    // The station tells the Worker where the rows are filed, the platforms which to read; Golemio takes the platforms.
    it('names a board\'s station and the platforms it shows, aliases included', () => {
        expect(departuresRequestId(resolveStop(andel(), 'U1040-1')!)).toBe('U1040-1:U1040Z1P,U1040Z101P,U1040Z102P');
        expect(departuresRequestId(resolveStop(andel(), 'U1040Z101P')!)).toBe('U1040-1:U1040Z101P,U1040Z102P');
        expect(departuresRequestId(resolveStop(andel(), 'U1040Z1P,U1040Z101P')!)).toBe('U1040-1:U1040Z1P,U1040Z101P,U1040Z102P');
    });
});

describe('departureStopIds', () => {
    // A board's departures carry the request id they were asked under, not a plain stop id.
    it('reads the platforms out of a request id, aliases included', () => {
        expect([...departureStopIds(andel(), 'U1040-1:U1040Z101P,U1040Z102P')]).toEqual(['U1040Z101P', 'U1040Z102P']);
        expect([...departureStopIds(andel(), 'U1040Z1P')]).toEqual(['U1040Z1P']);
        expect([...departureStopIds(null, 'X1')]).toEqual(['X1']);
    });

    // A station with no platforms is requested as `station:`: the station is the stop.
    it('reads a request id naming no platforms as its station', () => {
        expect([...departureStopIds(null, 'X1:')]).toEqual(['X1']);
    });
});

describe('selectStop', () => {
    it('asks for departures once the stop list has loaded', () => {
        expect(selectStop('U1040-1', null)).toEqual({ id: 'U1040-1', board: null, departuresId: null });
        expect(selectStop('U1040Z1P', andel()).departuresId).toBe('U1040-1:U1040Z1P');
    });

    it('asks for the URL id of a stop the list does not know', () => {
        expect(selectStop('X9', andel()).departuresId).toBe('X9');
    });
});

describe('board helpers', () => {
    // A notice names any id of a platform; the station board must find it under each.
    it('lists every id a board\'s stops go by', () => {
        expect(boardStopIds(resolveStop(andel(), 'U1040-1')!)).toEqual(['U1040-1', 'U1040Z1P', 'U1040Z101P', 'U1040Z102P']);
    });

    it('maps each id of a coded platform to its code', () => {
        expect([...platformCodes(andel().platforms)]).toEqual([['U1040Z1P', 'A']]);
    });

    // PID lists a platform once per fare zone; the app shows the pair as the one platform it is.
    it('splits a board into platform sections only for a station of several platforms', () => {
        expect(isStationBoard(resolveStop(andel(), 'U1040-1')!)).toBe(true);
        expect(isStationBoard(resolveStop(stopModel([{ id: 'S', platforms: [{ id: 'P' }] }]), 'S')!)).toBe(false);
        expect(isStationBoard(resolveStop(andel(), 'U1040Z1P')!)).toBe(false);
    });
});
