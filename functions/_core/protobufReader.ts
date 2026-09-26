/**
 * A minimal protobuf reader, shared by every purpose-built decoder in this codebase (GTFS-RT
 * vehicles, GTFS-RT alerts): each decoder reads only the fields it needs, several times faster than
 * a generated decoder that builds every field of every message. Sub-messages share one cursor and
 * are bounded by an end offset, so decoding allocates nothing but the decoded objects themselves.
 */

export const WIRE_VARINT = 0;
const WIRE_FIXED64 = 1;
export const WIRE_BYTES = 2;
const WIRE_FIXED32 = 5;

const utf8 = new TextDecoder();

export class ProtobufReader {
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
