/**
 * Normalizes a date string from PID RSS format into a JavaScript Date object.
 * Handles various formats like "DD.MM. HH:MM", "DD.MM.YYYY HH:MM", and Unix timestamps.
 *
 * @param dateStr Raw date string from RSS
 * @param referenceDate Base date for filling in missing years (default: current date)
 * @param pubDate Optional publication date to derive the year from
 * @returns Date object or null if invalid
 */
export const normalizeRSSDate = (dateStr: string, referenceDate: Date = new Date(), pubDate?: string): Date | null => {
    const normalized = dateStr.trim();
    if (!normalized || normalized.toLowerCase().includes('do odvolání')) return null;

    // Handle Unix Timestamps
    if (normalized.match(/^\d{10,}$/)) {
        const d = new Date(parseInt(normalized) * 1000);
        return isNaN(d.getTime()) ? null : d;
    }

    try {
        const refYear = pubDate ? new Date(pubDate).getFullYear() : referenceDate.getFullYear();

        // Format: "1.2. 12:30" (DD.MM. HH:MM)
        const partialMatch = normalized.match(/^(\d{1,2})\.(\d{1,2})\. (\d{1,2}):(\d{2})$/);
        if (partialMatch) {
            const [, d, m, hh, mm] = partialMatch;
            const date = new Date(refYear, parseInt(m) - 1, parseInt(d), parseInt(hh), parseInt(mm));
            return isNaN(date.getTime()) ? null : date;
        }

        // Format: "1.2.2024 12:30" (DD.MM.YYYY HH:MM)
        const fullMatch = normalized.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}) (\d{1,2}):(\d{2})$/);
        if (fullMatch) {
            const [, d, m, y, hh, mm] = fullMatch;
            const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(hh), parseInt(mm));
            return isNaN(date.getTime()) ? null : date;
        }

        // Fallback to standard Date constructor
        const d = new Date(normalized.includes(' ') ? normalized.replace(' ', 'T') : normalized);
        return isNaN(d.getTime()) ? null : d;
    } catch {
        return null;
    }
};

/**
 * Extracts content from an XML tag using regex and cleans up CDATA and common entities.
 *
 * @param xml XML string to search in
 * @param tag Tag name to extract (case-insensitive)
 * @returns Inner text content of the tag
 */
export const getXMLTagContent = (xml: string, tag: string): string => {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return (match ? match[1] : "")
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&nbsp;/g, ' ')
        .trim();
};
