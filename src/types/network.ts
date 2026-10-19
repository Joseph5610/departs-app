/**
 * One piece of a city's always-visible network (`network.json` from departs-data). Lines drawn one by
 * one (metro) carry their route's id, name and colour; merged modes carry only their GTFS route type.
 */
export interface NetworkLineProperties {
    route_type: number;
    route_id?: string;
    name?: string;
    route_color?: string;
}

export interface NetworkLineFeature {
    type: "Feature";
    geometry: {
        type: "LineString";
        coordinates: [number, number][];
    };
    properties: NetworkLineProperties;
}

export interface NetworkLineCollection {
    type: "FeatureCollection";
    features: NetworkLineFeature[];
}
