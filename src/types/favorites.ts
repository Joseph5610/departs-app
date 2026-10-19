import type { BoardStop } from './stops';

/** A line in one direction at one stop, pinned to the favourites panel. */
export interface FavoriteLine {
    /** Stop ids repeat across networks, so a pin belongs to the city it was made in. */
    city: string;
    stopId: string;
    line: string;
    headsign: string;
}

/** A pinned stop: the id as first pinned, which may be an alias or a pre-stops.json PID id, and the stop it opens. */
export interface PinnedStop {
    id: string;
    /** Every pinned id that opens this stop, all of which unpinning removes. */
    ids: string[];
    stop: BoardStop;
}
