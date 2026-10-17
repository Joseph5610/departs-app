import { describe, expect, it } from 'vitest';
import { stationOfRequest, toStopRequest } from './stopRequests';

describe('toStopRequest', () => {
    it('reads a station node from its platforms, whatever the station id looks like', () => {
        expect(toStopRequest('centroid-952', [null, '952-1', '952-2'])).toEqual({ id: 'centroid-952', node: '952', post: null });
        expect(toStopRequest('952', [null, '952-1', '952-2'])).toEqual({ id: '952', node: '952', post: null });
    });

    it('splits a platform into its node and post', () => {
        expect(toStopRequest('952-3', ['952'])).toEqual({ id: '952-3', node: '952', post: '3' });
    });

    it('reads an id the stop index does not know as a platform or a bare node', () => {
        expect(toStopRequest('952-3', undefined)).toEqual({ id: '952-3', node: '952', post: '3' });
        expect(toStopRequest('952', undefined)).toEqual({ id: '952', node: '952', post: null });
    });
});

describe('stationOfRequest', () => {
    it('is the station itself, a platform\'s parent, or none for an unknown id', () => {
        expect(stationOfRequest('952', [null, '952-1'])).toBe('952');
        expect(stationOfRequest('952-1', ['centroid-952'])).toBe('centroid-952');
        expect(stationOfRequest('952-1', undefined)).toBeNull();
    });
});
