/**
 * PID `stop_icons` codes, in PID's documented order: the modes a rider can change to at a stop.
 * `M*` codes are metro lines; the rest are modes.
 */
const INTERCHANGE_CODES = ['Ma', 'Mb', 'Mc', 'Md', 'Ra', 'Sb', 'Fu', 'Fe', 'Ap', 'Tw', 'Tb', 'Bu'] as const;

const RANK = new Map<string, number>(INTERCHANGE_CODES.map((code, i) => [code, i]));

/** Codes in PID order; unknown codes go last. */
export const sortInterchanges = (codes: Iterable<string>): string[] =>
    [...codes].sort((a, b) => (RANK.get(a) ?? RANK.size) - (RANK.get(b) ?? RANK.size) || a.localeCompare(b));

/** Metro line name of an `M*` code (`Mc` -> `C`), or null for other modes. */
export const metroLineOf = (code: string): string | null => code.length === 2 && code[0] === 'M' ? code[1].toUpperCase() : null;
