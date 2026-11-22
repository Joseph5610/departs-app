import { describe, expect, it } from 'vitest';
import { isWaitingToStart } from './schedule';

describe('isWaitingToStart', () => {
    // A vehicle matched hours before its trip waits for it; it is not running hours early.
    it('holds a vehicle matched well ahead of its start as waiting', () => {
        expect(isWaitingToStart(159)).toBe(true);
    });

    it('stops waiting in the last minute before the start and once the trip began', () => {
        expect(isWaitingToStart(0.5)).toBe(false);
        expect(isWaitingToStart(-5)).toBe(false);
    });

    it('does not wait once the vehicle reached a later stop', () => {
        expect(isWaitingToStart(30, 3)).toBe(false);
    });
});
