/**
 * GTFS-RT types this codebase actually reads or writes, hand-written to match
 * `gtfs-realtime-bindings`'s generated `.d.ts` field-for-field. Every decode in this codebase is our
 * own lean parser (`_core/protobufReader.ts`, `_core/gtfsRtAlerts.ts`, `_feeds/gtfs/gtfs-rt-decode.ts`);
 * this replaces the dependency's types (and its `VehicleStopStatus` enum) so nothing here still
 * depends on it.
 */

export interface ITripDescriptor {
    tripId?: string | null;
    routeId?: string | null;
    directionId?: number | null;
    startTime?: string | null;
    startDate?: string | null;
    scheduleRelationship?: number | null;
}

export interface IPosition {
    latitude: number;
    longitude: number;
    bearing?: number | null;
    odometer?: number | null;
    speed?: number | null;
}

export interface IVehicleDescriptor {
    id?: string | null;
    label?: string | null;
    licensePlate?: string | null;
}

export enum VehicleStopStatus {
    INCOMING_AT = 0,
    STOPPED_AT = 1,
    IN_TRANSIT_TO = 2,
}

export interface IVehiclePosition {
    trip?: ITripDescriptor | null;
    vehicle?: IVehicleDescriptor | null;
    position?: IPosition | null;
    currentStopSequence?: number | null;
    stopId?: string | null;
    currentStatus?: VehicleStopStatus | number | null;
    timestamp?: number | null;
}

export interface ITranslation {
    text: string;
    language?: string | null;
}

export interface ITranslatedString {
    translation?: ITranslation[] | null;
}

export interface ITimeRange {
    start?: number | null;
    end?: number | null;
}

export interface IEntitySelector {
    agencyId?: string | null;
    routeId?: string | null;
    routeType?: number | null;
    stopId?: string | null;
    directionId?: number | null;
}

/** `Alert.cause`/`Alert.effect` are read only through `String(...)`, so the raw number suffices. */
export interface IAlert {
    activePeriod?: ITimeRange[] | null;
    informedEntity?: IEntitySelector[] | null;
    cause?: number | null;
    effect?: number | null;
    url?: ITranslatedString | null;
    headerText?: ITranslatedString | null;
    descriptionText?: ITranslatedString | null;
    /** PID's own extension (field 17); not part of standard GTFS-RT. */
    causeDetail?: ITranslatedString | null;
}

export interface IFeedEntity {
    id: string;
    isDeleted?: boolean | null;
    vehicle?: IVehiclePosition | null;
    alert?: IAlert | null;
}
