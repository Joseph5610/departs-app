import { describe, expect, it } from 'vitest';
import type { Infotext, RSSItem } from '@/types';
import { MIN, NOW, at } from '@/test/factories';
import { activeNotices, alertSections, alertsForLine, incidentsOnLines, noticesByPlatform } from './lists';

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

const notice = (id: string, relatedStopIds: string[], priority: Infotext['priority'] = 'normal'): Infotext => ({
    id, text: id, textEn: null, priority, displayType: 'inline', relatedStopIds, valid_from: at(0), valid_to: null,
});

describe('noticesByPlatform', () => {
    // A station board names the platforms a notice concerns instead of showing every platform's notice as the station's.
    it('files platform notices under their codes and keeps station-wide or unknown ones whole', () => {
        const platforms = new Map([['Z1', 'A'], ['Z2', 'B'], ['Z10', '10']]);
        const result = noticesByPlatform([
            notice('b-low', ['Z2'], 'low'),
            notice('b-high', ['Z2'], 'high'),
            notice('both', ['Z1', 'Z10']),
            notice('station', ['S1']),
            notice('elsewhere', ['X9']),
        ], ['S1', 'Z1', 'Z2', 'Z10'], platforms);

        expect(result.station.map(n => n.id)).toEqual(['station']);
        expect(result.platforms.map(p => [p.code, p.notices.map(n => n.id)])).toEqual([
            ['10', ['both']],
            ['A', ['both']],
            ['B', ['b-high', 'b-low']],
        ]);
    });
});

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

describe('incidentsOnLines', () => {
    // The home sheet raises only what touches the rider's own lines; planned exclusions and ended incidents stay out.
    it('keeps active incidents on the given lines, high priority first', () => {
        const alerts = [
            alert('other line', { type: 'incident', line_metadata: [line('9', 'tram')] }),
            alert('low', { type: 'incident', line_metadata: [line('17', 'tram')] }),
            alert('high', { type: 'incident', priority: 'high', line_metadata: [line('c', 'metro')] }),
            alert('planned', { type: 'exclusion', line_metadata: [line('17', 'tram')] }),
            alert('ended', { type: 'incident', isActive: false, line_metadata: [line('17', 'tram')] }),
        ];
        expect(incidentsOnLines(alerts, new Set(['17', 'C'])).map(a => a.title)).toEqual(['high', 'low']);
        expect(incidentsOnLines(alerts, new Set())).toEqual([]);
    });
});
