/**
 * A trip's operating window: `[start_mins, end_mins, dayFlags]`.
 *
 * `dayFlags` is a bitmask over `TripWindows.days`; `-1` means the trip carries no date
 * restriction and should be treated as operating on any day.
 */
export type TripWindow = [number, number, number];

export interface TripWindows {
    days: string[];
    trips: Record<string, TripWindow>;
}
