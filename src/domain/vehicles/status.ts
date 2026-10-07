/** Why the vehicle panel warns about a trip; each names its `map.vehicleDetails.*` texts. */
export type VehicleNotice = 'canceled' | 'staticFallback' | 'beforeTrackDelayed' | 'previousTrip' | 'offTrack';

/** The warning a trip's state calls for, or null; a timetable-only trip warns until it has ended. */
export const vehicleNotice = (state: string | undefined, isStaticFallback: boolean, hasEnded: boolean): VehicleNotice | null => {
    const isFlagged = state === 'canceled' || state === 'before_track' || state === 'before_track_delayed' || state === 'off_track';
    if (!isFlagged && !(isStaticFallback && !hasEnded)) return null;
    if (state === 'canceled') return 'canceled';
    if (isStaticFallback) return 'staticFallback';
    if (state === 'before_track_delayed') return 'beforeTrackDelayed';
    if (state === 'before_track') return 'previousTrip';
    return 'offTrack';
};
