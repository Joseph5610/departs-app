import type { BoardStop } from './stops';

/** A line in one direction at one stop, pinned to the favourites panel. */
export interface FavoriteLine {
    /** Stop ids repeat across networks, so a pin belongs to the city it was made in. */
    city: string;
    stopId: string;
    line: string;
    headsign: string;
}

/** A stop pinned in one city. */
export interface FavoriteStop {
    /** Absent on a pin saved before pins carried their city; the first city whose stops know the id claims it. */
    city?: string;
    /** As pinned, which may be an alias or a pre-stops.json PID id. */
    stopId: string;
}

/** A pinned stop as listed: its first pin, every pin that opens it (all of which unpinning removes), and the stop. */
export interface PinnedStop {
    pin: FavoriteStop;
    pins: FavoriteStop[];
    stop: BoardStop;
}
