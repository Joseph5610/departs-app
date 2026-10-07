import type { StopTimeFeature } from '@/types';
import { addSecondsToTime } from '@/domain/time';

/** The first stop after `current`; null before the trip starts or after its last stop. */
export const nextStopSequence = (stops: StopTimeFeature[], current: number | null): number | null => {
    if (current === null) return null;
    let next: number | null = null;
    for (const s of stops) {
        const seq = Number(s.properties.stop_sequence);
        if (seq > current && (next === null || seq < next)) next = seq;
    }
    return next;
};

/** The first stop from `current` on with transfers, in timetable order. */
export const firstTransferSequence = (stops: StopTimeFeature[], current: number | null): number | null => {
    const first = stops.find((s) => Number(s.properties.stop_sequence) >= (current ?? 0) && !!s.properties.connections?.length);
    return first ? Number(first.properties.stop_sequence) : null;
};

/** Stops the vehicle has already left; none before the trip starts. */
export const pastStopsCount = (stops: StopTimeFeature[], current: number | null): number =>
    current === null ? 0 : stops.filter((s) => Number(s.properties.stop_sequence) < current).length;

/** The stop's expected and scheduled time; the vehicle's live delay overrides the backend's realtime time for upcoming stops. */
export const stopDisplayTimes = (stop: StopTimeFeature, isPast: boolean, isCurrent: boolean, isLastStop: boolean, delay: number | null | undefined) => {
    const { realtime_arrival_time, realtime_departure_time, arrival_time, departure_time } = stop.properties;

    // A terminus departure is the vehicle's layover until its next run (KORDIS trains: hours later).
    const showsDeparture = (isPast || isCurrent) && !isLastStop;
    const rtTime = showsDeparture
        ? (realtime_departure_time || realtime_arrival_time)
        : (realtime_arrival_time || realtime_departure_time);
    const schTime = showsDeparture
        ? (departure_time || arrival_time)
        : (arrival_time || departure_time);

    const realtimeTime = schTime && typeof delay === 'number' && !isPast
        ? addSecondsToTime(schTime, delay)
        : rtTime || schTime;
    const hasRealtime = (!!rtTime && rtTime !== schTime) || (!!schTime && !!delay && delay !== 0 && !isPast);

    return { realtimeTime, scheduledTime: schTime, hasRealtime };
};
