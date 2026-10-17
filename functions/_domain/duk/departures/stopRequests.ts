import type { StopRelation } from '../../../_feeds/gtfs/departureRows';

/** A requested stop id resolved to its Portabo node and, for a platform, its post. */
export interface StopRequest {
    id: string;
    node: string;
    post: string | null;
}

/** A Portabo platform id `<node>-<post>` as its parts; a bare node has no post. */
const splitPlatformId = (id: string): { node: string; post: string | null } => {
    const [node, post] = id.split('-');
    return { node: node ?? id, post: post ?? null };
};

/**
 * A requested id as its Portabo node and post. A station's node is read from its platforms, never from the
 * station id, so the data may name stations however it likes; an id the stop index does not know is read as
 * a platform or a bare node.
 */
export function toStopRequest(id: string, relation: StopRelation | undefined): StopRequest {
    const firstPlatform = relation?.[0] === null ? relation[1] : undefined;
    if (firstPlatform) return { id, node: splitPlatformId(firstPlatform).node, post: null };
    return { id, ...splitPlatformId(id) };
}

/** The station whose platforms a requested id's board labels: the id itself for a station, its parent for a platform. */
export function stationOfRequest(id: string, relation: StopRelation | undefined): string | null {
    if (!relation) return null;
    return relation[0] === null ? id : relation[0];
}
