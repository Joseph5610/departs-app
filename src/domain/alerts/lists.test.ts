import { describe, expect, it } from 'vitest';
import type { AlertLine, Infotext, RSSItem } from '@/types';
import { MIN, NOW, at } from '@/test/factories';
import { activeNotices, alertSections, alertsForLine, incidentsOnLines, boardNotices } from './lists';

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

const line = (name: string, type: AlertLine['type']): AlertLine => ({ name, type });

const notice = (id: string, relatedStopIds: string[], priority: Infotext['priority'] = 'normal'): Infotext => ({
    id, text: id, textEn: null, priority, displayType: 'inline', relatedStopIds, valid_from: at(0), valid_to: null,
});

describe('boardNotices', () => {
    // A station board names the platforms a notice concerns instead of showing every platform's notice as the station's.
    it('files platform notices under their codes and keeps station-wide or unknown ones whole', () => {
        const platforms = new Map([['Z1', 'A'], ['Z2', 'B'], ['Z10', '10']]);
        const result = boardNotices([
            notice('b-low', ['Z2'], 'low'),
            notice('b-high', ['Z2'], 'high'),
            notice('both', ['Z1', 'Z10']),
            notice('station', ['S1']),
            notice('elsewhere', ['X9']),
        ], ['S1', 'Z1', 'Z2', 'Z10'], platforms);

        expect(result.shown.map(n => n.id)).toEqual(['station']);
        expect(result.platformCodes).toEqual(['10', 'A', 'B']);
        expect(result.platformPriority).toBe('high');
    });
});

describe('alertSections', () => {
    // Trolleybuses are listed with buses; alerts without lines fall under "other", after every mode.
    it('groups alerts by their first known mode, in mode order', () => {
        const sections = alertSections([
            alert('bus', { resolvedLines: [line('136', 'bus')] }),
            alert('trolley', { resolvedLines: [line('58', 'trolleybus')] }),
            alert('tram', { resolvedLines: [line('?', 'unknown'), line('22', 'tram')] }),
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
            alert('future', { resolvedLines: tram, isActive: false, priority: 'high' }),
            alert('normal', { resolvedLines: tram }),
            alert('urgent', { resolvedLines: tram, priority: '1' }),
            alert('incident', { resolvedLines: tram, type: 'incident', isActive: false }),
        ], 'all', '');

        expect(section.items.map((i) => i.title)).toEqual(['incident', 'urgent', 'normal', 'future']);
    });

    it('filters by type and searches title, description and lines without diacritics', () => {
        const alerts = [
            alert('Výluka Anděl', { resolvedLines: [line('9', 'tram')] }),
            alert('Nehoda', { type: 'incident', description: 'Smíchovské nádraží', resolvedLines: [line('7', 'tram')] }),
        ];

        expect(alertSections(alerts, 'incident', '').flatMap((s) => s.items.map((i) => i.title))).toEqual(['Nehoda']);
        expect(alertSections(alerts, 'all', 'andel').flatMap((s) => s.items.map((i) => i.title))).toEqual(['Výluka Anděl']);
        expect(alertSections(alerts, 'all', 'smichovske').flatMap((s) => s.items.map((i) => i.title))).toEqual(['Nehoda']);
    });
});

describe('alertsForLine', () => {
    it('keeps active alerts naming the line, high priority first', () => {
        const result = alertsForLine([
            alert('other line', { resolvedLines: [line('9', 'tram')] }),
            alert('inactive', { resolvedLines: [line('22', 'tram')], isActive: false }),
            alert('normal', { resolvedLines: [line('22', 'tram')] }),
            alert('high', { resolvedLines: [line('22', 'tram')], priority: 'high' }),
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

describe('incidentsOnLines', () => {
    // The home sheet raises only what touches the rider's own lines; planned exclusions and ended incidents stay out.
    it('keeps active incidents on the given lines, high priority first', () => {
        const alerts = [
            alert('other line', { type: 'incident', resolvedLines: [line('9', 'tram')] }),
            alert('low', { type: 'incident', resolvedLines: [line('17', 'tram')] }),
            alert('high', { type: 'incident', priority: 'high', resolvedLines: [line('c', 'metro')] }),
            alert('planned', { type: 'exclusion', resolvedLines: [line('17', 'tram')] }),
            alert('ended', { type: 'incident', isActive: false, resolvedLines: [line('17', 'tram')] }),
        ];
        expect(incidentsOnLines(alerts, new Set(['17', 'C'])).map(a => a.title)).toEqual(['high', 'low']);
        expect(incidentsOnLines(alerts, new Set())).toEqual([]);
    });
});
