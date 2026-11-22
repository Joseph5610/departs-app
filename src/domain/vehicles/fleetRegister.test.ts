import { describe, expect, it } from 'vitest';
import { czechPlateOf, fleetRegisterUrl, vehicleIdentifiers } from './fleetRegister';

describe('czechPlateOf', () => {
    it('spaces a plate the feed sends packed', () => {
        expect(czechPlateOf('1BX5363')).toBe('1BX 5363');
        expect(czechPlateOf('9u6 2955')).toBe('9U6 2955');
        expect(czechPlateOf('EL123AB')).toBe('EL 123AB');
    });

    it('rejects fleet numbers', () => {
        expect(czechPlateOf('1083')).toBeNull();
        expect(czechPlateOf('300411')).toBeNull();
    });
});

describe('fleetRegisterUrl', () => {
    it('links a plate directly, whatever the city or operator', () => {
        expect(fleetRegisterUrl('brno', 'IDS JMK', '1BX5363')).toBe('https://seznam-autobusu.cz/seznam?spz=1BX+5363');
    });

    it('links a Prague fleet number within the operator the detail names', () => {
        expect(fleetRegisterUrl('prague', 'DP PRAHA', 6809))
            .toBe('https://seznam-autobusu.cz/seznam?prov=1&dopravce=Dopravn%C3%AD+podnik+hl.+m.+Prahy&evc=6809&zapujcka=2');
    });

    it('links a Brno vehicle the fleet register names DPMB for', () => {
        expect(fleetRegisterUrl('brno', 'DPMB', '2682')).toBe('https://seznam-autobusu.cz/seznam?prov=1&dopravce=DPMB&evc=2682&zapujcka=2');
    });

    it('links Prešov vehicles under the register name, not the ambiguous DPMP', () => {
        expect(fleetRegisterUrl('presov', 'DPMP', '428')).toBe('https://seznam-autobusu.cz/seznam?prov=1&dopravce=DP+mesta+Pre%C5%A1ov&evc=428&zapujcka=2');
    });

    // Prague's operator names the contract holder, not the subcontractor who owns the vehicle.
    it('searches a Prague number of any other carrier across Czech carriers', () => {
        expect(fleetRegisterUrl('prague', 'ČSAD POLKOST', '8273')).toBe('https://seznam-autobusu.cz/seznam?prov=1&operatorCountryId=1&evc=8273&zapujcka=2');
        expect(fleetRegisterUrl('prague', undefined, '8273')).toContain('operatorCountryId=1&evc=8273');
    });

    // A fleet number is unique only within its carrier, so an unknown carrier outside Prague gets no link.
    it('gives no link when the carrier is unknown and the city has no country fallback', () => {
        expect(fleetRegisterUrl('brno', 'IDS JMK', '1083')).toBeNull();
        expect(fleetRegisterUrl('brno', undefined, '1083')).toBeNull();
        expect(fleetRegisterUrl('duk', 'Doprava Ústeckého kraje', '300411')).toBeNull();
    });

    it('gives no link without a usable number', () => {
        expect(fleetRegisterUrl('prague', 'DP PRAHA', undefined)).toBeNull();
        expect(fleetRegisterUrl('prague', 'DP PRAHA', '')).toBeNull();
        expect(fleetRegisterUrl('prague', 'DP PRAHA', 'service-3-6809')).toBeNull();
    });
});

describe('vehicleIdentifiers', () => {
    it('names a numeric registration as the fleet number, not again as the vehicle id', () => {
        expect(vehicleIdentifiers('1921', '1921', '01204')).toEqual({ fleetNumber: '1921', plate: undefined, run: '01204' });
    });

    it('prefers a numeric registration over a feed-internal vehicle id', () => {
        expect(vehicleIdentifiers('service-3-8536', '8536', undefined).fleetNumber).toBe('8536');
    });

    it('shows a plate alone, not the feed vehicle id beside it', () => {
        expect(vehicleIdentifiers('21529', '2BU5867', undefined)).toEqual({ fleetNumber: undefined, plate: '2BU 5867', run: undefined });
    });

    it('falls back to the vehicle id without a registration and drops empty facts', () => {
        expect(vehicleIdentifiers('7203', undefined, '0')).toEqual({ fleetNumber: '7203', plate: undefined, run: undefined });
    });
});
