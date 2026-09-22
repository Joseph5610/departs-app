import type { transit_realtime } from 'gtfs-realtime-bindings';

/**
 * A GTFS-RT feed read for vehicles only: vehicle entities decoded to the fields the app reads, alert
 * entities kept as raw bytes for the alerts path to decode on its own schedule.
 */
export interface GtfsRtFeed {
    entity: transit_realtime.IFeedEntity[];
    alertEntities: Uint8Array[];
}

const WIRE_VARINT = 0;
const WIRE_FIXED64 = 1;
const WIRE_BYTES = 2;
const WIRE_FIXED32 = 5;

const utf8 = new TextDecoder();

/**
 * Minimal protobuf cursor over one buffer. Sub-messages share it and are bounded by an end offset, so
 * decoding allocates nothing but the decoded objects.
 */
class Reader {
    pos = 0;
    private readonly view: DataView;

    constructor(readonly buf: Uint8Array) {
        this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    }

    /** Varints up to 2^53, enough for uint64 timestamps. */
    varint(): number {
        let byte = this.buf[this.pos++];
        if (byte < 0x80) return byte;
        let result = byte & 0x7f;
        let factor = 128;
        do {
            byte = this.buf[this.pos++];
            result += (byte & 0x7f) * factor;
            factor *= 128;
        } while (byte & 0x80);
        return result;
    }

    float(): number {
        const value = this.view.getFloat32(this.pos, true);
        this.pos += 4;
        return value;
    }

    double(): number {
        const value = this.view.getFloat64(this.pos, true);
        this.pos += 8;
        return value;
    }

    /** Reads a length prefix and returns where that field ends; the cursor is left at its start. */
    end(): number {
        const length = this.varint();
        return this.pos + length;
    }

    string(): string {
        const length = this.varint();
        const start = this.pos;
        const end = start + length;
        this.pos = end;
        let text = '';
        for (let i = start; i < end; i++) {
            const byte = this.buf[i];
            if (byte > 0x7f) return utf8.decode(this.buf.subarray(start, end));
            text += String.fromCharCode(byte);
        }
        return text;
    }

    skip(wireType: number): void {
        if (wireType === WIRE_VARINT) this.varint();
        else if (wireType === WIRE_FIXED64) this.pos += 8;
        else if (wireType === WIRE_BYTES) {
            const length = this.varint();
            this.pos += length;
        }
        else if (wireType === WIRE_FIXED32) this.pos += 4;
        else throw new Error(`Unsupported protobuf wire type ${wireType}`);
    }
}

function readTrip(r: Reader, end: number): transit_realtime.ITripDescriptor {
    const trip: transit_realtime.ITripDescriptor = {};
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

function readPosition(r: Reader, end: number): transit_realtime.IPosition {
    const position: transit_realtime.IPosition = { latitude: 0, longitude: 0 };
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

function readDescriptor(r: Reader, end: number): transit_realtime.IVehicleDescriptor {
    const descriptor: transit_realtime.IVehicleDescriptor = {};
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

function readVehicle(r: Reader, end: number): transit_realtime.IVehiclePosition {
    const vehicle: transit_realtime.IVehiclePosition = {};
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
        const entity: transit_realtime.IFeedEntity = { id: '' };
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
