
/**
 * Normalizes a date string from PID RSS format.
 * Common formats: 
 * - "1748226600" (Unix timestamp in seconds)
 * - "9.2. 04:30" (missing year)
 * - "09.02.2026 04:30"
 * - "2026-02-09 04:30"
 */
const normalizeDate = (dateStr: string, referenceDate: Date = new Date(), pubDate?: string): Date | null => {
    let normalized = dateStr.trim();
    if (!normalized || normalized.toLowerCase().includes('do odvolání')) return null;

    // 1. Handle Unix Timestamp (seconds) - PID RSS uses this for dateFrom/dateTo
    if (normalized.match(/^\d{10,}$/)) {
        const d = new Date(parseInt(normalized) * 1000);
        return isNaN(d.getTime()) ? null : d;
    }

    try {
        // Use publication date as reference for the year if provided
        const refYear = pubDate ? new Date(pubDate).getFullYear() : referenceDate.getFullYear();

        // Handle DD.MM. HH:mm or D.M. HH:mm (missing year)
        const partialMatch = normalized.match(/^(\d{1,2})\.(\d{1,2})\. (\d{1,2}):(\d{2})$/);
        if (partialMatch) {
            const [_, d, m, hh, mm] = partialMatch;
            const date = new Date(refYear, parseInt(m) - 1, parseInt(d), parseInt(hh), parseInt(mm));
            return isNaN(date.getTime()) ? null : date;
        }

        // Handle DD.MM.YYYY HH:mm
        const fullMatch = normalized.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}) (\d{1,2}):(\d{2})$/);
        if (fullMatch) {
            const [_, d, m, y, hh, mm] = fullMatch;
            const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(hh), parseInt(mm));
            return isNaN(date.getTime()) ? null : date;
        }

        // Fallback to standard constructor for ISO-like strings
        const d = new Date(normalized.includes(' ') ? normalized.replace(' ', 'T') : normalized);
        return isNaN(d.getTime()) ? null : d;
    } catch (e) {
        return null;
    }
};

/**
 * Checks if a transport alert is currently active.
 */
export const isAlertActive = (item: any): boolean => {
    // Incidents (mimoriadnosti) are assumed active if they are in the feed
    if (item.type === 'incidents') return true;

    const now = new Date();
    const { dateFrom, dateTo, date, isoDate } = item;

    // 1. Try explicit dateFrom/dateTo if they exist
    let start = normalizeDate(dateFrom || '', now, isoDate);
    let end = normalizeDate(dateTo || '', now, isoDate);

    // 2. Fallback to parsing the 'date' string which often contains a range "Start - End"
    if (!start && date) {
        const parts = date.split('-');
        if (parts.length >= 1) {
            start = normalizeDate(parts[0], now, isoDate);
        }
        if (!end && parts.length >= 2) {
            end = normalizeDate(parts[1], now, isoDate);
        }
    }

    // If we can't find a start date, assume it's active (immediate incident)
    if (!start) return true;

    if (start > now) return false; // Future
    if (end && end < now) return false; // Past

    return true;
};

/**
 * Checks if an alert is scheduled for the future.
 */
export const isAlertFuture = (item: any): boolean => {
    // Incidents are never considered "future" - they are immediate
    if (item.type === 'incidents') return false;

    const now = new Date();
    const { dateFrom, date, isoDate } = item;

    let start = normalizeDate(dateFrom || '', now, isoDate);

    if (!start && date) {
        const parts = date.split('-');
        if (parts.length >= 1) {
            start = normalizeDate(parts[0], now, isoDate);
        }
    }

    return start ? start > now : false;
};
