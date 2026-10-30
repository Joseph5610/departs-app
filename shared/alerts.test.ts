import { describe, expect, it } from 'vitest';
import { ALERT_RULES, alertPhase } from './alerts';

const NOW = Date.parse('2026-10-30T12:00:00Z');
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const STALE = ALERT_RULES.INCIDENT_STALE_AFTER_MS;

describe('alertPhase', () => {
    it('places a window around now', () => {
        expect(alertPhase({ valid_from: at(60_000), valid_to: null }, NOW)).toBe('upcoming');
        expect(alertPhase({ valid_from: at(-60_000), valid_to: at(60_000) }, NOW)).toBe('current');
        expect(alertPhase({ valid_from: at(-120_000), valid_to: at(-60_000) }, NOW)).toBe('ended');
    });

    // KORDIS incidents carry no dates: they hold while the feed publishes them.
    it('treats an alert without dates as current', () => {
        expect(alertPhase({ valid_from: null, valid_to: null }, NOW)).toBe('current');
    });

    // PID keeps some incidents open-ended for years; past the limit they are leftovers.
    it('turns an open-ended alert stale once it has run longer than the limit', () => {
        expect(alertPhase({ valid_from: at(-STALE), valid_to: null }, NOW)).toBe('current');
        expect(alertPhase({ valid_from: at(-STALE - 1), valid_to: null }, NOW)).toBe('stale');
    });

    it('keeps a long alert with a future end current', () => {
        expect(alertPhase({ valid_from: at(-3 * STALE), valid_to: at(60_000) }, NOW)).toBe('current');
    });
});
