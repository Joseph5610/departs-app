import { describe, expect, it } from 'vitest';
import type { StopRelation } from '../../../_feeds/gtfs/departureRows';
import { stopTargets } from './stopTargets';

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
