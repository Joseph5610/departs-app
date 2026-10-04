/**
 * Normalizes a string by converting it to lowercase and removing diacritics (accents).
 * e.g., "Čakovice" -> "cakovice"
 */
export const normalizeString = (str: string): string => {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
};

/** `list` with `item` added, or removed when already present. */
export const toggled = (list: string[], item: string): string[] =>
    list.includes(item) ? list.filter(i => i !== item) : [...list, item];
