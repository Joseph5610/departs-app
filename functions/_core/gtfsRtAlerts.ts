import type * as GtfsRt from './gtfsRtTypes';
import { ProtobufReader as Reader, WIRE_BYTES } from './protobufReader';

/**
 * Decodes GTFS-RT `Alert` entities directly, several times faster than the generated decoder since it
 * builds only the fields `mapGtfsAlerts` and its network-specific hooks read. Shared by every network
 * whose alerts are GTFS-RT (KORDIS/Brno reads pre-split entity bytes; Golemio/Prague decodes its whole
 * `alerts.pb` feed here). Field numbers are taken from `gtfs-realtime-bindings`'s own generated
 * encoder, not guessed.
 */

function readTranslation(r: Reader, end: number): GtfsRt.ITranslation {
    const translation: GtfsRt.ITranslation = { text: '' };
    while (r.pos < end) {
        const tag = r.varint();
        const field = tag >>> 3;
        if (field === 1) translation.text = r.string();
        else if (field === 2) translation.language = r.string();
        else r.skip(tag & 7);
    }
    return translation;
}

function readTranslatedString(r: Reader, end: number): GtfsRt.ITranslatedString {
    const translations: GtfsRt.ITranslation[] = [];
    while (r.pos < end) {
        const tag = r.varint();
        const field = tag >>> 3;
        if (field === 1) translations.push(readTranslation(r, r.end()));
        else r.skip(tag & 7);
    }
    return { translation: translations };
}

function readTimeRange(r: Reader, end: number): GtfsRt.ITimeRange {
    const range: GtfsRt.ITimeRange = {};
    while (r.pos < end) {
        const tag = r.varint();
        const field = tag >>> 3;
        if (field === 1) range.start = r.varint();
        else if (field === 2) range.end = r.varint();
        else r.skip(tag & 7);
    }
    return range;
}

/** Only `routeId` is read anywhere downstream; every other `EntitySelector` field is skipped. */
function readEntitySelector(r: Reader, end: number): GtfsRt.IEntitySelector {
    const selector: GtfsRt.IEntitySelector = {};
    while (r.pos < end) {
        const tag = r.varint();
        const field = tag >>> 3;
        if (field === 2) selector.routeId = r.string();
        else r.skip(tag & 7);
    }
    return selector;
}

function readAlert(r: Reader, end: number): GtfsRt.IAlert {
    const alert: GtfsRt.IAlert & { causeDetail?: GtfsRt.ITranslatedString } = {};
    const activePeriod: GtfsRt.ITimeRange[] = [];
    const informedEntity: GtfsRt.IEntitySelector[] = [];
    while (r.pos < end) {
        const tag = r.varint();
        const field = tag >>> 3;
        if (field === 1) activePeriod.push(readTimeRange(r, r.end()));
        else if (field === 5) informedEntity.push(readEntitySelector(r, r.end()));
        // Plain `.decode()` (what production calls, confirmed by direct property access - NOT
        // JSON.stringify, which silently runs protobufjs's own toJSON()/toObject() and converts
        // these to their enum names) gives the raw number; do not "fix" this to a name again.
        else if (field === 6) alert.cause = r.varint();
        else if (field === 7) alert.effect = r.varint();
        else if (field === 8) alert.url = readTranslatedString(r, r.end());
        else if (field === 10) alert.headerText = readTranslatedString(r, r.end());
        else if (field === 11) alert.descriptionText = readTranslatedString(r, r.end());
        else if (field === 17) alert.causeDetail = readTranslatedString(r, r.end());
        else r.skip(tag & 7);
    }
    if (activePeriod.length > 0) alert.activePeriod = activePeriod;
    if (informedEntity.length > 0) alert.informedEntity = informedEntity;
    return alert;
}

/** One pre-split `FeedEntity` (its `alert` submessage), as `getGtfsRtAlerts` (Brno/KORDIS) reads it. */
export function decodeAlertEntity(bytes: Uint8Array): GtfsRt.IFeedEntity {
    const r = new Reader(bytes);
    const entity: GtfsRt.IFeedEntity = { id: '' };
    while (r.pos < bytes.length) {
        const tag = r.varint();
        const field = tag >>> 3;
        if (field === 1) entity.id = r.string();
        else if (field === 5) entity.alert = readAlert(r, r.end());
        else r.skip(tag & 7);
    }
    return entity;
}

/** The alert entities of a whole GTFS-RT `FeedMessage`, as Golemio's `alerts.pb` (Prague) is read. */
export function decodeAlertFeed(bytes: Uint8Array): GtfsRt.IFeedEntity[] {
    const entities: GtfsRt.IFeedEntity[] = [];
    const r = new Reader(bytes);

    while (r.pos < bytes.length) {
        const tag = r.varint();
        if (tag >>> 3 !== 2 || (tag & 7) !== WIRE_BYTES) {
            r.skip(tag & 7);
            continue;
        }

        const entityEnd = r.end();
        const entity: GtfsRt.IFeedEntity = { id: '' };
        while (r.pos < entityEnd) {
            const entityTag = r.varint();
            const field = entityTag >>> 3;
            if (field === 1) entity.id = r.string();
            else if (field === 5) entity.alert = readAlert(r, r.end());
            else r.skip(entityTag & 7);
        }
        if (entity.alert) entities.push(entity);
    }

    return entities;
}
