import { describe, expect, it } from 'vitest';
import type { AppAlert } from '../../../_core/types';
import type { KordisDiversion } from '../../../_feeds/kordis/diversions';
import { enrichWithDiversions, indexDiversions } from './diversions';

const TZ = 'Europe/Prague';
const LINK = 'https://example.test';
const NOW = Date.parse('2026-10-18T12:00:00Z');

const rtAlert = (title: string, overrides: Partial<AppAlert> = {}): AppAlert => ({
    type: 'exclusion', title, description: null, link: LINK, valid_from: null, valid_to: null, guid: `lockout_${title}`, ...overrides,
});

const diversion = (title: string, validfrom: string | null, validto: string | null, overrides: Partial<KordisDiversion> = {}): KordisDiversion => ({
    diversionid: 1, number_: null, title, publictext: null, affectedlines: null, type_: 'V', validfrom, validto, latitude: null, longitude: null, ...overrides,
});

const enrich = (alerts: AppAlert[], diversions: KordisDiversion[]) => enrichWithDiversions(alerts, indexDiversions(diversions, TZ, LINK), NOW);

describe('enrichWithDiversions', () => {
    it('gives a matched RT lockout its Prague-local validity window, matching titles loosely', () => {
        const [alert] = enrich([rtAlert('Uzavírka ulice Fryčajovy')], [diversion('Uzavírka  ulice Fryčajovy ', '01.11.2025 06:15', '31.10.2027 23:59')]);
        expect(alert).toMatchObject({ valid_from: '2025-11-01T05:15:00.000Z', valid_to: '2027-10-31T22:59:00.000Z' });
    });

    // The open-data copy lags a day: an end it already passed must not mark a lockout RT still runs as ended.
    it('leaves a lockout alone when its diversion already ended', () => {
        const alerts = [rtAlert('Ivanovice')];
        expect(enrich(alerts, [diversion('Ivanovice', '22.08.2026 00:00', '17.10.2026 23:55')])).toBe(alerts);
    });

    it('keeps incidents and alerts with their own dates untouched', () => {
        const alerts = [rtAlert('A', { type: 'incident' }), rtAlert('B', { valid_from: '2026-01-01T00:00:00.000Z' })];
        expect(enrich(alerts, [diversion('A', '01.01.2026 00:00', '01.01.2027 00:00'), diversion('B', '01.02.2026 00:00', '01.01.2027 00:00')])).toBe(alerts);
    });

    it('places a matched lockout, even one with its own dates, at its diversion', () => {
        const [alert] = enrich(
            [rtAlert('Uzavírka Branka', { valid_from: '2026-01-01T00:00:00.000Z' })],
            [diversion('Uzavírka Branka', '01.01.2026 00:00', null, { latitude: 49.2025, longitude: 16.6419 })],
        );
        expect(alert).toMatchObject({ valid_from: '2026-01-01T00:00:00.000Z', location: { lat: 49.2025, lon: 16.6419 } });
    });

    it('places upcoming diversions, but not at a missing or zero point', () => {
        const result = enrich([], [
            diversion('Placed', '24.10.2026 07:00', null, { diversionid: 1, latitude: 49.2, longitude: 16.6 }),
            diversion('Zero', '24.10.2026 07:00', null, { diversionid: 2, latitude: 0, longitude: 0 }),
            diversion('Missing', '24.10.2026 07:00', null, { diversionid: 3 }),
        ]);
        expect(result.map(a => [a.title, a.location])).toEqual([['Placed', { lat: 49.2, lon: 16.6 }], ['Zero', undefined], ['Missing', undefined]]);
    });

    it('appends diversions not started yet as upcoming exclusions, soonest first', () => {
        const result = enrich([rtAlert('Now')], [
            diversion('Later', '24.10.2026 07:20', '26.10.2026 04:30', { diversionid: 2 }),
            diversion('Soon', '19.10.2026 00:00', '30.11.2026 23:59', { diversionid: 3, affectedlines: '4, x75 ,N94, xS71., 4', publictext: 'Line one\n Line two\n\n\n\nEnd ' }),
            diversion('Gone', '01.10.2026 00:00', '17.10.2026 23:59', { diversionid: 4 }),
        ]);
        expect(result.map(a => a.guid)).toEqual(['lockout_Now', 'diversion_3', 'diversion_2']);
        expect(result[1]).toEqual({
            type: 'exclusion', title: 'Soon', description: 'Line one\nLine two\n\nEnd', link: LINK,
            valid_from: '2026-10-18T22:00:00.000Z', valid_to: '2026-11-30T22:59:00.000Z', guid: 'diversion_3', priority: 'normal',
            lines: ['4', 'x75', 'N94', 'xS71'], effect: '4',
        });
    });

    // RT may list a lockout before its start; the upcoming copy would show it twice.
    it('does not append an upcoming diversion the RT feed already lists', () => {
        const alerts = [rtAlert('Výluka Husova')];
        expect(enrich(alerts, [diversion('Výluka Husova', '24.10.2026 07:00', '25.10.2026 20:00')])).toBe(alerts);
    });

    // KORDIS posts a short notice and later a detailed one for the same closure, both kept in the RT feed.
    it('keeps only the newest of the lockouts posted for one closure, each matched by its own text', () => {
        const result = enrich(
            [
                rtAlert('Uzavírka ulice Branka', { guid: 'lockout_25', description: 'Z důvodu rekonstrukce komunikace je od pondělí naplánována uzavírka.' }),
                rtAlert('Uzavírka ulice Branka', { guid: 'lockout_27', description: 'Z důvodu rekonstrukce bude od 4:30 hod. uzavřena.' }),
                rtAlert('Jiná', { guid: 'lockout_30' }),
            ],
            [
                diversion('Uzavírka ulice Branka', '27.07.2026 00:00', '24.11.2026 23:59', { diversionid: 9678, number_: 'DPMB_V2607-059', publictext: 'Z důvodu rekonstrukce komunikace je od pondělí naplánována uzavírka.' }),
                diversion('Uzavírka ulice Branka', '27.07.2026 04:30', '24.11.2026 23:59', { diversionid: 9698, number_: 'DPMB_V2607-059', publictext: 'Z důvodu rekonstrukce bude od 4:30 hod. uzavřena.' }),
            ],
        );
        expect(result.map(a => [a.guid, a.valid_from])).toEqual([['lockout_27', '2026-07-27T02:30:00.000Z'], ['lockout_30', null]]);
    });

    it('appends only the newest upcoming notice of one closure', () => {
        const result = enrich([], [
            diversion('Uzavírka Branka', '24.10.2026 00:00', null, { diversionid: 1, number_: 'DPMB_V2610-001' }),
            diversion('Uzavírka ulice Branka', '24.10.2026 04:30', null, { diversionid: 2, number_: 'DPMB_V2610-001' }),
        ]);
        expect(result.map(a => a.guid)).toEqual(['diversion_2']);
    });

    it('does not merge lockouts sharing a placeholder closure number', () => {
        const alerts = [rtAlert('A', { valid_from: 'x' }), rtAlert('B', { valid_from: 'x' })];
        const diversions = [
            diversion('A', '01.01.2026 00:00', null, { diversionid: 1, number_: 'DPMB' }),
            diversion('B', '01.01.2026 00:00', null, { diversionid: 2, number_: 'DPMB' }),
        ];
        expect(enrich(alerts, diversions)).toBe(alerts);
    });

    it('skips diversions without a usable title or any readable date', () => {
        const alerts = [rtAlert('A')];
        const junk = [diversion('A', null, 'soon'), { ...diversion('B', '19.10.2026 00:00', null), title: 42 } as unknown as KordisDiversion];
        expect(enrich(alerts, junk)).toBe(alerts);
    });

    it('returns the RT alerts themselves without diversions', () => {
        const alerts = [rtAlert('A')];
        expect(enrich(alerts, [])).toBe(alerts);
    });
});
