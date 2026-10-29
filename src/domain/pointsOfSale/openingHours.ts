import { POS_OPENING } from '@/config/constants';
import type { PointOfSale } from '@/types';
import { timeToSeconds } from '@shared/time';

type OpeningHours = PointOfSale['openingHours'];

const DAY_S = 86_400;
const RANGE = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/;

export type OpeningStatus =
    | { kind: 'nonstop' }
    | { kind: 'open'; closesAt: string; closingSoon: boolean }
    /** `inDays` is 0 when it opens later today, 1 tomorrow and so on; null when no day opens. */
    | { kind: 'closed'; opensAt: string | null; inDays: number | null };

interface Interval { start: number; end: number; startText: string; endText: string }

/** Intervals of one `hours` text ("6:00-12:45,13:15-20:00"), or null when it is free text the panel can only show. */
const parseHours = (hours: string): Interval[] | null => {
    const intervals: Interval[] = [];
    for (const part of hours.split(',')) {
        const match = RANGE.exec(part.trim());
        if (!match) return null;
        const start = timeToSeconds(match[1]);
        const end = timeToSeconds(match[2]);
        if (end <= start) return null;
        intervals.push({ start, end, startText: match[1].replace(/^0(\d)/, '$1'), endText: match[2].replace(/^0(\d)/, '$1') });
    }
    return intervals;
};

/** Whether an opening-hours entry spans `day` (0 = Monday). */
export const coversDay = (entry: OpeningHours[number], day: number): boolean => entry.from <= day && day <= entry.to;

/** Parsed intervals per weekday, or null when any entry is free text. */
const weekIntervals = (openingHours: OpeningHours): Interval[][] | null => {
    const week: Interval[][] = Array.from({ length: 7 }, () => []);
    for (const entry of openingHours) {
        const intervals = parseHours(entry.hours);
        if (!intervals) return null;
        for (let day = entry.from; day <= entry.to && day < 7; day++) week[day].push(...intervals);
    }
    for (const day of week) day.sort((a, b) => a.start - b.start);
    return week;
};

/**
 * Open or closed at `secondsOfDay` on `day` (0 = Monday) in the point of sale's own time zone,
 * with when it next closes or opens; null when the hours are missing or free text.
 */
export const openingStatus = (openingHours: OpeningHours, day: number, secondsOfDay: number): OpeningStatus | null => {
    if (openingHours.length === 0 || day < 0) return null;
    const week = weekIntervals(openingHours);
    if (!week) return null;

    if (week.every(intervals => intervals.some(i => i.start === 0 && i.end >= DAY_S))) return { kind: 'nonstop' };

    const current = week[day].find(i => i.start <= secondsOfDay && secondsOfDay < i.end);
    if (current) {
        return { kind: 'open', closesAt: current.endText, closingSoon: current.end - secondsOfDay <= POS_OPENING.CLOSING_SOON_MIN * 60 };
    }

    for (let offset = 0; offset < 7; offset++) {
        const next = week[(day + offset) % 7].find(i => offset > 0 || i.start > secondsOfDay);
        if (next) return { kind: 'closed', opensAt: next.startText, inDays: offset };
    }
    return { kind: 'closed', opensAt: null, inDays: null };
};
