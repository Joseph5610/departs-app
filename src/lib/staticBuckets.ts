const utf8 = new TextEncoder();

/**
 * The file an id is hashed into on the static data CDN: FNV-1a (32-bit) of its UTF-8 bytes, modulo
 * `count`. Must match `bucketOf` in the departs-gtfs-data build script.
 */
export function bucketOf(id: string, count: number): string {
    let hash = 0x811c9dc5;
    for (const byte of utf8.encode(id)) {
        hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
    }
    return String(hash % count);
}
