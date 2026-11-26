import { describe, expect, it } from 'vitest';
import type { MetroExitsFile } from '@/types';
import { stopTime } from '@/test/factories';
import { carSpans, metroExitAdvice } from './metroExit';

const stops = [stopTime(1, '13:50:00', { stop_id: 'U400Z102P' }), stopTime(2, '13:52:00', { stop_id: 'U1072Z102P' })];

const file: MetroExitsFile = {
    U1072Z102P: { exits: [['E14', 'Václavské náměstí', [4, 5]], ['E8', null, [1, 2, 3]]], stepFree: ['E1', [1, 2]] },
    U400Z102P: { exits: [['E7', null, [1, 2, 3, 4, 5]]], stepFree: ['E7', [5, 4, 3, 2, 1]] },
};

describe('carSpans', () => {
    it('joins consecutive cars into runs', () => {
        expect(carSpans([5, 1, 2, 3, 3])).toEqual([[1, 3], [5, 5]]);
    });
});

describe('metroExitAdvice', () => {
    it('finds the exit platform by the stop id at the exit sequence, front cars first', () => {
        expect(metroExitAdvice(file, stops, 2)).toEqual({
            exits: [
                { name: 'E8', sign: null, cars: [1, 2, 3], spans: [[1, 3]], isStepFree: false },
                { name: 'E14', sign: 'Václavské náměstí', cars: [4, 5], spans: [[4, 5]], isStepFree: false },
            ],
            stepFree: { name: 'E1', cars: [1, 2], spans: [[1, 2]] },
        });
    });

    it('marks an exit that is also the step-free way with the same cars instead of repeating it', () => {
        const advice = metroExitAdvice(file, stops, 1);
        expect(advice?.stepFree).toBeNull();
        expect(advice?.exits).toMatchObject([{ name: 'E7', isStepFree: true }]);
    });

    it('gives nothing for a platform the file does not know or before anything loaded', () => {
        expect(metroExitAdvice({}, stops, 2)).toBeNull();
        expect(metroExitAdvice(undefined, stops, 2)).toBeNull();
        expect(metroExitAdvice(file, stops, null)).toBeNull();
    });
});
