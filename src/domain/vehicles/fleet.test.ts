import { describe, expect, it } from 'vitest';
import { fleetLookup, fleetRanges } from './fleet';

const lookup = fleetLookup(fleetRanges({
    DPP: [
        { min: 9200, max: 9299, vehicle_type: 'Škoda 15T', is_air_conditioned: true },
        { min: 9400, max: 9440, vehicle_type: 'Škoda 52T', is_air_conditioned: true, is_wheelchair_accessible: true },
    ],
    'Arriva City': [{ min: 1000, max: 1099, vehicle_type: 'SOR NS 12' }],
}));

// The register is contiguous number ranges per operator, searched across operators by vehicle number.
describe('fleetLookup', () => {
    it('finds the range holding a vehicle number, bounds included, with its operator', () => {
        expect(lookup('9200')).toMatchObject({ operator: 'DPP', vehicle_type: 'Škoda 15T' });
        expect(lookup('9440')).toMatchObject({ operator: 'DPP', vehicle_type: 'Škoda 52T' });
        expect(lookup('1050')).toMatchObject({ operator: 'Arriva City' });
    });

    it('misses gaps, non-numeric ids and empty ids', () => {
        expect(lookup('9300')).toBeUndefined();
        expect(lookup('bus-12')).toBeUndefined();
        expect(lookup(null)).toBeUndefined();
    });
});
