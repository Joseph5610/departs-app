import { describe, expect, it } from 'vitest';
import type { NetworkCoverage } from '@/types';
import { findCityAt, isCityVisible, nearestCityCentreIn, pickCity, type Box } from './coverage';

const city = (slug: string, center: [number, number]) => ({ slug, center, bounds: [center[0] - 1, center[1] - 1, center[0] + 1, center[1] + 1] as [number, number, number, number] });

// One-degree cells: Prague's grid holds 1000 stops around 14|50, DÚK's 80 there (8 %) and 400 around 13|50.
const coverages = new Map<string, NetworkCoverage>([
    ['prague', { cell: 1, cells: { '14|50': 1000 } }],
    ['duk', { cell: 1, cells: { '14|50': 80, '13|50': 400 } }],
]);
const cities = [city('prague', [14.42, 50.08]), city('duk', [13.9, 50.5]), city('brno', [16.6, 49.2])];
const praha: Box = [14.1, 50.1, 14.9, 50.9];
const usti: Box = [13.1, 50.1, 13.9, 50.9];

// Kladno lies in both PID and DÚK; the selection only moves when the selected network nearly vanishes from view.
describe('pickCity', () => {
    it('keeps the selected network while it has a fair share of the stops in view', () => {
        expect(pickCity(cities, coverages, praha, 'duk')?.slug).toBe('duk');
        expect(pickCity(cities, new Map([...coverages, ['duk', { cell: 1, cells: { '14|50': 30 } }]]), praha, 'duk')?.slug).toBe('prague');
    });

    it('moves to the busiest network once the selected one has no stops in view', () => {
        expect(pickCity(cities, coverages, usti, 'prague')?.slug).toBe('duk');
    });

    it('keeps a selected network whose coverage has not loaded yet', () => {
        expect(pickCity(cities, coverages, usti, 'brno')?.slug).toBe('brno');
    });

    it('finds the network at a point, keeping the selected one where it runs a fair share', () => {
        expect(findCityAt(cities, coverages, [13.5, 50.5])?.slug).toBe('prague');
        expect(findCityAt(cities, coverages, [13.5, 50.5], 'duk')?.slug).toBe('duk');
    });
});

describe('nearestCityCentreIn', () => {
    // Zoomed out over an area no network covers, the city whose centre is nearest the view centre wins.
    it('picks the visible city centre nearest the view centre', () => {
        expect(nearestCityCentreIn(cities, [12, 48, 18, 51], [16, 49])?.slug).toBe('brno');
        expect(nearestCityCentreIn(cities, [0, 0, 1, 1], [0.5, 0.5])).toBeUndefined();
    });
});

describe('isCityVisible', () => {
    it('offers a hidden city only on a device that unlocked it', () => {
        expect(isCityVisible({ slug: 'presov', isHidden: true }, [])).toBe(false);
        expect(isCityVisible({ slug: 'presov', isHidden: true }, ['presov'])).toBe(true);
        expect(isCityVisible({ slug: 'prague' }, [])).toBe(true);
    });
});
