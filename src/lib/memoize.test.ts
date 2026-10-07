import { describe, expect, it } from 'vitest';
import { mapStable, memoizeLast } from './memoize';

describe('mapStable', () => {
    // Downstream memoizeLast pipelines key on array identity; an unchanged pass must not look like new data.
    it('returns the input array itself when no item changes', () => {
        const items = [{ a: 1 }, { a: 2 }];
        expect(mapStable(items, (item) => item)).toBe(items);
    });

    it('returns a new array when any item changes, keeping the unchanged ones', () => {
        const items = [{ a: 1 }, { a: 2 }];
        const result = mapStable(items, (item) => (item.a === 2 ? { a: 3 } : item));
        expect(result).not.toBe(items);
        expect(result[0]).toBe(items[0]);
        expect(result[1]).toEqual({ a: 3 });
    });
});

describe('memoizeLast', () => {
    it('reuses the result for the same arguments and recomputes for new ones', () => {
        let calls = 0;
        const double = memoizeLast((xs: number[]) => { calls++; return xs.map((x) => x * 2); });
        const input = [1, 2];

        expect(double(input)).toBe(double(input));
        double([1, 2]);
        expect(calls).toBe(2);
    });
});
