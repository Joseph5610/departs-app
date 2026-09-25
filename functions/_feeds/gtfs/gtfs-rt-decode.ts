import type * as GtfsRt from '../../_core/gtfsRtTypes';
import { ProtobufReader as Reader, WIRE_BYTES } from '../../_core/protobufReader';

/**
 * A GTFS-RT feed read for vehicles only: vehicle entities decoded to the fields the app reads, alert
 * entities kept as raw bytes for the alerts path to decode on its own schedule.
 */
export interface GtfsRtFeed {
    entity: GtfsRt.IFeedEntity[];
    alertEntities: Uint8Array[];
}

function readTrip(r: Reader, end: number): GtfsRt.ITripDescriptor {
    const trip: GtfsRt.ITripDescriptor = {};
    while (r.pos < end) {
        const tag = r.varint();
        const field = tag >>> 3;
        if (field === 1) trip.tripId = r.string();
        else if (field === 2) trip.startTime = r.string();
        else if (field === 3) trip.startDate = r.string();
        else if (field === 4) trip.scheduleRelationship = r.varint();
        else if (field === 5) trip.routeId = r.string();
        else if (field === 6) trip.directionId = r.varint();
        else r.skip(tag & 7);
    }
    return trip;
}

function readPosition(r: Reader, end: number): GtfsRt.IPosition {
    const position: GtfsRt.IPosition = { latitude: 0, longitude: 0 };
    while (r.pos < end) {
        const tag = r.varint();
        const field = tag >>> 3;
        if (field === 1) position.latitude = r.float();
        else if (field === 2) position.longitude = r.float();
        else if (field === 3) position.bearing = r.float();
        else if (field === 4) position.odometer = r.double();
        else if (field === 5) position.speed = r.float();
        else r.skip(tag & 7);
    }
    return position;
}

function readDescriptor(r: Reader, end: number): GtfsRt.IVehicleDescriptor {
    const descriptor: GtfsRt.IVehicleDescriptor = {};
    while (r.pos < end) {
        const tag = r.varint();
        const field = tag >>> 3;
        if (field === 1) descriptor.id = r.string();
        else if (field === 2) descriptor.label = r.string();
        else if (field === 3) descriptor.licensePlate = r.string();
        else r.skip(tag & 7);
    }
    return descriptor;
}

function readVehicle(r: Reader, end: number): GtfsRt.IVehiclePosition {
    const vehicle: GtfsRt.IVehiclePosition = {};
    while (r.pos < end) {
        const tag = r.varint();
        const field = tag >>> 3;
        if (field === 1) vehicle.trip = readTrip(r, r.end());
        else if (field === 2) vehicle.position = readPosition(r, r.end());
        else if (field === 3) vehicle.currentStopSequence = r.varint();
        else if (field === 4) vehicle.currentStatus = r.varint();
        else if (field === 5) vehicle.timestamp = r.varint();
        else if (field === 7) vehicle.stopId = r.string();
        else if (field === 8) vehicle.vehicle = readDescriptor(r, r.end());
        else r.skip(tag & 7);
    }
    return vehicle;
}

/**
 * Decodes the vehicle positions of a GTFS-RT FeedMessage, several times faster than the generated
 * decoder since it builds only the fields read downstream. Alert entities are returned undecoded.
 */
export function decodeGtfsRtFeed(bytes: Uint8Array): GtfsRtFeed {
    const feed: GtfsRtFeed = { entity: [], alertEntities: [] };
    const r = new Reader(bytes);

    while (r.pos < bytes.length) {
        const tag = r.varint();
        if (tag >>> 3 !== 2 || (tag & 7) !== WIRE_BYTES) {
            r.skip(tag & 7);
            continue;
        }

        const entityEnd = r.end();
        const entityStart = r.pos;
        const entity: GtfsRt.IFeedEntity = { id: '' };
        let isAlert = false;
        while (r.pos < entityEnd) {
            const entityTag = r.varint();
            const field = entityTag >>> 3;
            if (field === 1) entity.id = r.string();
            else if (field === 2) entity.isDeleted = r.varint() !== 0;
            else if (field === 4) entity.vehicle = readVehicle(r, r.end());
            else {
                if (field === 5) isAlert = true;
                r.skip(entityTag & 7);
            }
        }

        if (isAlert) feed.alertEntities.push(bytes.subarray(entityStart, entityEnd));
        else if (entity.vehicle) feed.entity.push(entity);
    }

    return feed;
}
