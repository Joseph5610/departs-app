import { describe, expect, it } from 'vitest';
import type { StopRelation } from '../../../_feeds/gtfs/departureRows';
import { GTFS_CONFIG } from '../../../_feeds/gtfs/config';
import { requestedStopParts, stopTargets } from './stopTargets';

const relations = new Map<string, StopRelation>([
    ['U1396', [null, 'U1396Z1', 'U1396Z3']],
    ['U1396Z1', ['U1396']],
    ['U1396Z3', ['U1396']],
    ['U1271Z1', ['U1271']],
]);

describe('stopTargets', () => {
    it('expands a station into its platforms, read from its own bucket', () => {
        const t = stopTargets(['U1396'], relations);
        expect(t.targetIds).toEqual(['U1396Z1', 'U1396Z3']);
        expect(t.childToRequestedMap.get('U1396Z3')).toBe('U1396');
        expect(t.parentOf.get('U1396Z3')).toBe('U1396');
    });

    // A comma-joined value is one stop: every part's rows answer the value the client sent.
    it('reads a comma-joined value as one stop made of its parts', () => {
        const t = stopTargets(['U1396Z1,U1396Z3'], relations);
        expect(t.targetIds).toEqual(['U1396Z1', 'U1396Z3']);
        expect(t.childToRequestedMap.get('U1396Z1')).toBe('U1396Z1,U1396Z3');
        expect(t.childToRequestedMap.get('U1396Z3')).toBe('U1396Z1,U1396Z3');
        expect(t.parentOf.get('U1396Z3')).toBe('U1396');
    });

    it('keeps repeated values as separate stops', () => {
        const t = stopTargets(['U1396Z1', 'U1271Z1'], relations);
        expect(t.childToRequestedMap.get('U1396Z1')).toBe('U1396Z1');
        expect(t.childToRequestedMap.get('U1271Z1')).toBe('U1271Z1');
        expect(t.parentOf.get('U1271Z1')).toBe('U1271');
    });
});

describe('requestedStopParts', () => {
    // A single value may join any number of ids, so the cap counts the parts before any bucket is read.
    it('rejects comma-joined parts past the platform cap', () => {
        const ids = Array.from({ length: GTFS_CONFIG.MAX_DEPARTURE_TARGET_STOPS }, (_, i) => `Z${i}`);
        expect(requestedStopParts([ids.join(',')])).toHaveLength(ids.length);
        expect(() => requestedStopParts([ids.join(','), 'Z'])).toThrow(/Too many stops/);
    });
});
