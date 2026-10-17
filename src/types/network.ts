/** One line of a city's always-visible backbone network (`network.json` from departs-data). */
export interface NetworkLineProperties {
    route_id: string;
    name: string;
    route_type: number;
    route_color: string;
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
