/** Name matching both the app and the server apply. Plain TypeScript without imports: both builds compile it. */

/** Lowercase without diacritics, so `namesti svobody` finds `Náměstí Svobody`. Must match departs-data's `foldName`. */
export const foldDiacritics = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** A name reduced to lowercase ASCII letters and digits, for comparing names that networks punctuate and space differently. */
export const nameKey = (text: string): string => foldDiacritics(text).replace(/[^a-z0-9]/g, '');
