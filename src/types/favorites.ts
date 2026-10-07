/** A line in one direction at one stop, pinned to the favourites panel. */
export interface FavoriteLine {
    /** Stop ids repeat across networks, so a pin belongs to the city it was made in. */
    city: string;
    stopId: string;
    line: string;
    headsign: string;
}
