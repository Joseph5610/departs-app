import { describe, expect, it } from 'vitest';
import { byRequest, stopGroups } from './stopGroups';

describe('stopGroups', () => {
    // Golemio caps each group at 24 departures: a station asked as one group showed only its next ~17 minutes.
    it('asks for each platform as its own group, remembering the stop it belongs to', () => {
        expect(stopGroups([['U1Z1', 'U1Z1P'], ['U2Z1']], 60)).toEqual({ groups: [['U1Z1'], ['U1Z1P'], ['U2Z1']], requestOf: [0, 0, 1] });
    });

    it('keeps each requested stop one group when the platforms would make too many', () => {
        expect(stopGroups([['A', 'B'], ['C']], 2)).toEqual({ groups: [['A', 'B'], ['C']], requestOf: [0, 1] });
    });
});

describe('byRequest', () => {
    it('gathers the groups\' departures back under the stop each was asked for', () => {
        expect(byRequest([['a'], ['b'], ['c']], [0, 0, 1], 2)).toEqual([['a', 'b'], ['c']]);
    });
});
