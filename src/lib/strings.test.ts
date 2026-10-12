import { describe, expect, it } from 'vitest';
import { splitLastWord, wrappableName } from './strings';

const ZWSP = '\u200B';

// Stop names packed without spaces must wrap at a comma or slash, not mid-word or inside "n.L.".
describe('wrappableName', () => {
    it('allows a break after a comma or slash followed by text, and nowhere else', () => {
        expect(wrappableName('Kostelec n.L.,Martinská')).toBe(`Kostelec n.L.,${ZWSP}Martinská`);
        expect(wrappableName('Florenc/Těšnov')).toBe(`Florenc/${ZWSP}Těšnov`);
        expect(wrappableName('Letiště / Airport')).toBe('Letiště / Airport');
        expect(wrappableName('Sídliště Čakovice')).toBe('Sídliště Čakovice');
    });
});

describe('splitLastWord', () => {
    it('splits before the last word, keeping the space with the lead', () => {
        expect(splitLastWord('Nádraží Holešovice')).toEqual(['Nádraží ', 'Holešovice']);
        expect(splitLastWord('Háje')).toEqual(['', 'Háje']);
    });
});
