import { describe, expect, it } from 'vitest';
import type { StopRelation } from '../../../_feeds/gtfs/departureRows';
import { stationOfRequest, toStopRequest } from './stopRequests';

const relations = new Map<string, StopRelation>([
    ['952', [null, '952-1', '952-2', '952-3']],
    ['station-952', [null, '952-1', '952-2', '952-3']],
    ['952-1', ['952']],
    ['952-3', ['952']],
]);
const relationOf = (id: string) => relations.get(id);

describe('toStopRequest', () => {
    it('reads a station node from its platforms, whatever the station id looks like', () => {
        expect(toStopRequest('station-952', relationOf)).toEqual({ id: 'station-952', node: '952', posts: null });
        expect(toStopRequest('952', relationOf)).toEqual({ id: '952', node: '952', posts: null });
    });

    it('splits a platform into its node and post', () => {
        expect(toStopRequest('952-3', relationOf)).toEqual({ id: '952-3', node: '952', posts: ['3'] });
    });

    // A comma-joined value is one stop: the posts of one direction, or the whole station once a station is among them.
    it('reads a comma-joined value as the posts it names', () => {
        expect(toStopRequest('952-1,952-3', relationOf)).toEqual({ id: '952-1,952-3', node: '952', posts: ['1', '3'] });
        expect(toStopRequest('952-1,952', relationOf)).toEqual({ id: '952-1,952', node: '952', posts: null });
    });

    it('reads an id the stop index does not know as a platform or a bare node', () => {
        expect(toStopRequest('77-2', relationOf)).toEqual({ id: '77-2', node: '77', posts: ['2'] });
        expect(toStopRequest('77', relationOf)).toEqual({ id: '77', node: '77', posts: null });
    });
});

describe('stationOfRequest', () => {
    it('is the station itself, a platform\'s parent, or none for an unknown id', () => {
        expect(stationOfRequest('952', relationOf)).toBe('952');
        expect(stationOfRequest('952-1,952-3', relationOf)).toBe('952');
        expect(stationOfRequest('77-1', relationOf)).toBeNull();
    });
});
