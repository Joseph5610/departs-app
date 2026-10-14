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

/** Where a vehicle's delay comes from, as the detail presents it. */
export type DelaySource = 'live' | 'estimated' | 'standard';

/**
 * `live` from the city's push channel, `estimated` from the timetable and position (the app's own estimate,
 * or the backend's while the push channel has sent nothing), `standard` as the network's feed reports it.
 */
export const delaySourceOf = (vehicle: { is_enriched?: boolean; is_delay_estimated?: boolean }, hasPushChannel: boolean): DelaySource => {
    if (vehicle.is_enriched) return 'live';
    if (vehicle.is_delay_estimated || hasPushChannel) return 'estimated';
    return 'standard';
};
