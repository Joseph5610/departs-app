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
