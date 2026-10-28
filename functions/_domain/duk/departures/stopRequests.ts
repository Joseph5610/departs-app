import type { StopRelation } from '../../../_feeds/gtfs/departureRows';
import { parseStopRequest, requestParts } from '../../../../shared/stopIds';

/** A requested stop resolved to its Portabo node and the posts to read; null posts read the whole station. */
export interface StopRequest {
    id: string;
    node: string;
    posts: string[] | null;
}

/** A Portabo platform id `<node>-<post>` as its parts; a bare node has no post. */
const splitPlatformId = (id: string): { node: string; post: string | null } => {
    const [node, post] = id.split('-');
    return { node: node ?? id, post: post ?? null };
};

/** One id's node and post: a station's node is read from its platforms, never from the station id. */
const partOf = (id: string, relation: StopRelation | undefined): { node: string; post: string | null } => {
    const firstPlatform = relation?.[0] === null ? relation[1] : undefined;
    return firstPlatform ? { node: splitPlatformId(firstPlatform).node, post: null } : splitPlatformId(id);
};

/**
 * A requested value as its Portabo node and posts. A comma-joined value is one stop made of several platforms
 * of a node (one direction's); a station among them, a bare node, or every platform of the named station reads
 * the whole station. Parts on another node than the first are ignored. An id the data does not know is read as
 * a platform or a bare node.
 */
export function toStopRequest(id: string, relations: ReadonlyMap<string, StopRelation>): StopRequest {
    const { station, parts: named } = parseStopRequest(id);
    const all = named.map(part => partOf(part, relations.get(part)));
    const node = all[0]?.node ?? id;
    const parts = all.filter(p => p.node === node);
    const ofStation = station ? relations.get(station) : undefined;
    const isWholeStation = ofStation?.[0] === null && ofStation.slice(1).every(platform => named.includes(platform as string));
    const posts = isWholeStation || parts.some(p => p.post === null) ? null : [...new Set(parts.map(p => p.post as string))];
    return { id, node, posts };
}

/** The station whose platforms a requested value's board labels: its first part's station, if the data knows it. */
export function stationOfRequest(id: string, relations: ReadonlyMap<string, StopRelation>): string | null {
    const { station } = parseStopRequest(id);
    if (station) return station;
    const first = requestParts(id)[0];
    const relation = first ? relations.get(first) : undefined;
    if (!first || !relation) return null;
    return relation[0] === null ? first : relation[0];
}
