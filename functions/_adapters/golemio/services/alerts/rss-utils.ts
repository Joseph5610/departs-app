/**
 * Normalizes a date string from PID RSS format into a JavaScript Date object.
 */
export const normalizeRSSDate = (dateStr: string, referenceDate: Date = new Date(), pubDate?: string): Date | null => {
    const normalized = dateStr.trim();
    if (!normalized || normalized.toLowerCase().includes('do odvolání')) return null;

    if (normalized.match(/^\d{10,}$/)) {
        const d = new Date(parseInt(normalized) * 1000);
        return isNaN(d.getTime()) ? null : d;
    }

    try {
        const refYear = pubDate ? new Date(pubDate).getFullYear() : referenceDate.getFullYear();

        const partialMatch = normalized.match(/^(\d{1,2})\.(\d{1,2})\. (\d{1,2}):(\d{2})$/);
        if (partialMatch) {
            const [, d, m, hh, mm] = partialMatch;
            const date = new Date(refYear, parseInt(m) - 1, parseInt(d), parseInt(hh), parseInt(mm));
            return isNaN(date.getTime()) ? null : date;
        }

        const fullMatch = normalized.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}) (\d{1,2}):(\d{2})$/);
        if (fullMatch) {
            const [, d, m, y, hh, mm] = fullMatch;
            const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(hh), parseInt(mm));
            return isNaN(date.getTime()) ? null : date;
        }

        const d = new Date(normalized.includes(' ') ? normalized.replace(' ', 'T') : normalized);
        return isNaN(d.getTime()) ? null : d;
    } catch {
        return null;
    }
};

/**
 * Extracts content from an XML tag using regex and cleans up CDATA and common entities.
 */
export const getXMLTagContent = (xml: string, tag: string, attribute?: string): string => {
    if (attribute) {
        const regex = new RegExp(`<${tag}[^>]*?${attribute}=["']([^"']*)["'][^>]*>`, 'i');
        const match = xml.match(regex);
        return match ? match[1] : '';
    }
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return (match ? match[1] : '')
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&nbsp;/g, ' ')
        .trim();
};
