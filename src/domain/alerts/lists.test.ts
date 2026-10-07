import { describe, expect, it } from 'vitest';
import type { Infotext, RSSItem } from '@/types';
import { MIN, NOW, at } from '@/test/factories';
import { activeNotices, alertSections, alertsForLine } from './lists';

const alert = (title: string, overrides: Partial<RSSItem> = {}): RSSItem => ({
    type: 'exclusion',
    title,
    description: null,
    valid_from: null,
    valid_to: null,
    link: '',
    isActive: true,
    ...overrides,
});

const line = (name: string, type: NonNullable<RSSItem['line_metadata']>[number]['type']) => ({ name, type });

describe('alertSections', () => {
    // Trolleybuses are listed with buses; alerts without lines fall under "other", after every mode.
    it('groups alerts by their first known mode, in mode order', () => {
        const sections = alertSections([
            alert('bus', { line_metadata: [line('136', 'bus')] }),
            alert('trolley', { line_metadata: [line('58', 'trolleybus')] }),
            alert('tram', { line_metadata: [line('?', 'unknown'), line('22', 'tram')] }),
            alert('none'),
        ], 'all', '');

        expect(sections.map((s) => [s.mode, s.items.map((i) => i.title)])).toEqual([
            ['tram', ['tram']],
            ['bus', ['bus', 'trolley']],
            ['other', ['none']],
        ]);
    });

    it('orders a mode\'s alerts: incidents, then active ones, then high priority', () => {
        const tram = [line('22', 'tram')];
        const [section] = alertSections([
            alert('future', { line_metadata: tram, isActive: false, priority: 'high' }),
            alert('normal', { line_metadata: tram }),
            alert('urgent', { line_metadata: tram, priority: '1' }),
            alert('incident', { line_metadata: tram, type: 'incident', isActive: false }),
        ], 'all', '');

        expect(section.items.map((i) => i.title)).toEqual(['incident', 'urgent', 'normal', 'future']);
    });

    it('filters by type and searches title, description and lines without diacritics', () => {
        const alerts = [
            alert('Výluka Anděl', { line_metadata: [line('9', 'tram')] }),
            alert('Nehoda', { type: 'incident', description: 'Smíchovské nádraží', line_metadata: [line('7', 'tram')] }),
        ];

        expect(alertSections(alerts, 'incident', '').flatMap((s) => s.items.map((i) => i.title))).toEqual(['Nehoda']);
        expect(alertSections(alerts, 'all', 'andel').flatMap((s) => s.items.map((i) => i.title))).toEqual(['Výluka Anděl']);
        expect(alertSections(alerts, 'all', 'smichovske').flatMap((s) => s.items.map((i) => i.title))).toEqual(['Nehoda']);
    });
});

describe('alertsForLine', () => {
    it('keeps active alerts naming the line, high priority first', () => {
        const result = alertsForLine([
            alert('other line', { line_metadata: [line('9', 'tram')] }),
            alert('inactive', { line_metadata: [line('22', 'tram')], isActive: false }),
            alert('normal', { line_metadata: [line('22', 'tram')] }),
            alert('high', { line_metadata: [line('22', 'tram')], priority: 'high' }),
        ], '22');

        expect(result.map((a) => a.title)).toEqual(['high', 'normal']);
    });
});

describe('activeNotices', () => {
    const notice = (id: string, valid_from: string, valid_to: string | null): Infotext => ({
        id, text: id, textEn: null, priority: 'normal', displayType: 'inline', relatedStopIds: [], valid_from, valid_to,
    });

    it('keeps notices whose window holds now; one without an end stays valid', () => {
        const result = activeNotices([
            notice('open-ended', at(-MIN), null),
            notice('expired', at(-10 * MIN), at(-MIN)),
            notice('upcoming', at(MIN), null),
            notice('current', at(-MIN), at(MIN)),
        ], NOW);

        expect(result.map((n) => n.id)).toEqual(['open-ended', 'current']);
    });
});
