/** GTFS time of day, as both the app and the server read it. Plain TypeScript without imports: both builds compile it. */

/** Seconds in a day. */
export const DAY_S = 86_400;
const HALF_DAY_S = DAY_S / 2;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Seconds since midnight of an `HH:MM[:SS]` time; GTFS times past midnight run beyond 24 hours. */
export const timeToSeconds = (time: string): number => {
    const [h, m, s] = time.split(':').map(Number);
    return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
};

/** A difference of two times of day taken the short way round midnight, within ±12 hours. */
export const wrapDaySeconds = (diff: number): number => {
    if (diff < -HALF_DAY_S) return diff + DAY_S;
    if (diff > HALF_DAY_S) return diff - DAY_S;
    return diff;
};

/** An `HH:MM:SS` time moved by `seconds` and wrapped onto the clock, GTFS's 24+ hours included; '' stays ''. */
export const addSecondsToTime = (time: string, seconds: number): string => {
    if (!time) return '';
    let total = timeToSeconds(time) + seconds;
    if (total < 0) total += DAY_S;
    return `${pad2(Math.floor(total / 3600) % 24)}:${pad2(Math.floor((total % 3600) / 60))}:${pad2(Math.floor(total % 60))}`;
};
