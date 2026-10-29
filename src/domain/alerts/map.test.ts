import { describe, expect, it } from 'vitest';
import type { RSSItem } from '@/types';
import { alertIconKind, alertMapPoints } from './map';

const alert = (guid: string, overrides: Partial<RSSItem> = {}): RSSItem => ({
    type: 'exclusion', title: guid, description: null, link: '', valid_from: null, valid_to: null, guid,
    location: { lat: 49.2, lon: 16.6 }, isActive: true, isFuture: false, ...overrides,
});

describe('alertIconKind', () => {
    it('picks by effect, then cause, then type', () => {
        expect(alertIconKind('10', '4', 'exclusion')).toBe('detour');
        expect(alertIconKind('6', '7', 'incident')).toBe('accident');
        expect(alertIconKind('2', undefined, 'exclusion')).toBe('construction');
        expect(alertIconKind(undefined, undefined, 'incident')).toBe('warning');
    });
});

describe('alertMapPoints', () => {
    it('draws only placed alerts in force now', () => {
        const points = alertMapPoints([
            alert('now', { effect: '9', priority: '1' }),
            alert('later', { isActive: false, isFuture: true }),
            alert('ended', { isActive: false, isFuture: false }),
            alert('unplaced', { location: undefined }),
        ]);
        expect(points.features.map(f => [f.properties, f.geometry.coordinates])).toEqual([
            [{ guid: 'now', title: 'now', kind: 'stopMoved', tone: 'high' }, [16.6, 49.2]],
        ]);
    });
});
