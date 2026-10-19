/** A KORDIS line name as typed into a diversion, without the stray punctuation around it (`xS71.` -> `xS71`). */
const cleanLineName = (name: string): string => name.replace(/^[\s.,;:]+|[\s.,;:]+$/g, '');

/** Cleaned line names as `line_metadata`, duplicates and blanks dropped; undefined when none are left. */
export function lineMetadataOf(names: Iterable<string>): Array<{ route_id: string }> | undefined {
    const unique = new Set<string>();
    for (const name of names) {
        const clean = cleanLineName(name);
        if (clean) unique.add(clean);
    }
    return unique.size > 0 ? [...unique].map(route_id => ({ route_id })) : undefined;
}
