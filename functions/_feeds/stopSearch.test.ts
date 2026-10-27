import { describe, expect, it } from 'vitest';
import { StopSearch } from './stopSearch';

/** A search index as departs-data lays it out: one `name\tids` line per stop, stations empty, plus the binary columns. */
const searchOf = (lines: string[]): StopSearch => {
    const text = lines.map(line => `${line}\n`).join('');
    const count = lines.length;
    const bin = new ArrayBuffer(4 + (count + 1) * 4 + count * 8 + count);
    new Uint32Array(bin, 0, 1)[0] = count;
    const offsets = new Uint32Array(bin, 4, count + 1);
    let at = 0;
    lines.forEach((line, i) => { offsets[i] = at; at += line.length + 1; });
    offsets[count] = text.length;
    return new StopSearch(text, bin);
};

describe('StopSearch.byId', () => {
    const search = searchOf(['', 'mustek\tu1z1,u1z1a', 'mustek\tu1z11', 'u1z1 namesti\tu5z1']);

    // MCP maps a platform id it was sent to the platform's station; a near miss would name another station.
    it('finds a platform by its whole id or alias, never by a prefix or its name', () => {
        expect(search.byId('U1Z1')).toBe(1);
        expect(search.byId('u1z1a')).toBe(1);
        expect(search.byId('U1Z11')).toBe(2);
        expect(search.byId('U1Z')).toBeNull();
        expect(search.byId('u5z')).toBeNull();
    });
});
