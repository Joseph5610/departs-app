import { describe, expect, it } from 'vitest';
import { NOW } from '@/test/factories';
import { disruptionSyncKey, disruptionSyncSteps, type CityWatch } from './pushSync';

const LINES = [{ name: '9', keys: ['9', 'L9'] }];
const RENEW = 1000;
const options = { endpoint: 'e', title: 'Mimořádnost', pathOf: (city: string) => `/${city}`, now: NOW, renewAfterMs: RENEW };
const syncedAt = (at: number, lines = LINES, title = options.title) => ({ key: disruptionSyncKey('e', lines, title, '/prague'), at });
const prague: CityWatch = { city: 'prague', lines: LINES };

describe('disruptionSyncSteps', () => {
    it('adds every pinned city, not only the selected one', () => {
        expect(disruptionSyncSteps([prague, { city: 'brno', lines: LINES }], {}, options).map(step => `${step.action} ${step.city}`)).toEqual(['add prague', 'add brno']);
    });

    it('sends nothing for a copy that is current', () => {
        expect(disruptionSyncSteps([prague], { prague: syncedAt(NOW - RENEW + 1) }, options)).toEqual([]);
    });

    it('renews a copy due for it, so the server never lets it lapse', () => {
        expect(disruptionSyncSteps([prague], { prague: syncedAt(NOW - RENEW) }, options)).toMatchObject([{ action: 'add', city: 'prague' }]);
    });

    it('sends again when the lines, the language or the subscription changed', () => {
        const other = [{ name: '22', keys: ['22'] }];
        expect(disruptionSyncSteps([{ city: 'prague', lines: other }], { prague: syncedAt(NOW) }, options)).toHaveLength(1);
        expect(disruptionSyncSteps([prague], { prague: syncedAt(NOW, LINES, 'Disruption') }, options)).toHaveLength(1);
        expect(disruptionSyncSteps([prague], { prague: syncedAt(NOW) }, { ...options, endpoint: 'rotated' })).toHaveLength(1);
    });

    it('removes a recorded city with nothing pinned any more', () => {
        const synced = { prague: syncedAt(NOW), brno: syncedAt(NOW) };
        expect(disruptionSyncSteps([{ city: 'prague', lines: [] }], synced, options)).toEqual([{ action: 'remove', city: 'prague' }, { action: 'remove', city: 'brno' }]);
    });

    // A failed or slow routes read must not look like the pins are gone.
    it('leaves a city alone until its routes are known', () => {
        expect(disruptionSyncSteps([{ city: 'prague', lines: null }], { prague: syncedAt(NOW) }, options)).toEqual([]);
    });
});
