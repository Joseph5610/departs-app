import { describe, expect, it } from 'vitest';
import type { IndoorIndex } from '@/types';
import { activeIndoorStation, adjacentIndoorLevel, shownIndoorLevel } from './stations';
import { indoorLevelToken, toIndoorMap } from './mapFeatures';

const INDEX: IndoorIndex = {
    version: 4,
    stations: {
        mustek: { name: 'Můstek', levels: [-5, -3, 1], bbox: [14.4219, 50.0819, 14.4266, 50.0849], v: 'a' },
        muzeum: { name: 'Muzeum', levels: [-2, -1], bbox: [14.4280, 50.0780, 14.4335, 50.0810], v: 'b' },
    },
};

describe('activeIndoorStation', () => {
    it('picks the plan on screen', () => {
        expect(activeIndoorStation(INDEX, [14.4230, 50.0825, 14.4250, 50.0845])).toBe('mustek');
    });

    // On Václavské náměstí both plans touch the screen; the one nearer its centre wins, so one plan shows at a time.
    it('picks the plan nearest the screen centre when several are on screen', () => {
        expect(activeIndoorStation(INDEX, [14.4250, 50.0790, 14.4310, 50.0825])).toBe('muzeum');
        expect(activeIndoorStation(INDEX, [14.4220, 50.0800, 14.4290, 50.0840])).toBe('mustek');
    });

    it('is null without a plan on screen', () => {
        expect(activeIndoorStation(INDEX, [14.40, 50.06, 14.41, 50.07])).toBeNull();
    });
});

describe('shownIndoorLevel', () => {
    it('keeps the floor picked at the same station', () => {
        expect(shownIndoorLevel([-5, -3, 1], 'mustek', { station: 'mustek', level: -5 }, 0)).toBe(-5);
    });

    // Floor numbers of one station mean nothing at the next.
    it('ignores a floor picked at another station', () => {
        expect(shownIndoorLevel([-2, -1, 0], 'muzeum', { station: 'mustek', level: -2 }, 0)).toBe(0);
    });

    it('opens on street level, else the floor nearest it, the upper one on a tie', () => {
        expect(shownIndoorLevel([-3, 0, 1], 'x', null, 0)).toBe(0);
        expect(shownIndoorLevel([-5, -3], 'x', null, 0)).toBe(-3);
        expect(shownIndoorLevel([-1, 1], 'x', null, 0)).toBe(1);
    });
});

describe('adjacentIndoorLevel', () => {
    it('steps to the next floor the plan has, skipping missing ones', () => {
        expect(adjacentIndoorLevel([-3, -1, 0, 1], -1, 'down')).toBe(-3);
        expect(adjacentIndoorLevel([-3, -1, 0, 1], -1, 'up')).toBe(0);
    });

    it('is null past the top or bottom floor', () => {
        expect(adjacentIndoorLevel([0, 1], 1, 'up')).toBeNull();
        expect(adjacentIndoorLevel([0, 1], 0, 'down')).toBeNull();
    });
});

describe('toIndoorMap', () => {
    it('tags each feature with tokens its floors can be filtered by', () => {
        const map = toIndoorMap({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [14.43, 50.08] }, properties: { k: 'elevator', lv: [-1, 0] } }] });
        expect(map.features[0]?.properties).toEqual({ k: 'elevator', lv: [-1, 0], lvs: ';-1;0;' });
        expect(map.features[0]?.properties?.lvs).toContain(indoorLevelToken(-1));
        expect(map.features[0]?.properties?.lvs).not.toContain(indoorLevelToken(1));
    });
});
