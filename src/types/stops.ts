export interface StopFeature {
    type: "Feature";
    geometry: {
        type: "Point";
        coordinates: [number, number];
    };
    properties: {
        stop_id: string;
        stop_name: string;
        platform_code?: string;
        location_type: number;
        parent_station?: string;
        zone_id?: string;
        is_centroid?: boolean;
        is_train?: number;
        metro_a?: number;
        metro_b?: number;
        metro_c?: number;
        metro_lines?: string[];
        variant_seed?: number;
        all_ids?: string[];
    };
}

export interface StopCollection {
    type: "FeatureCollection";
    features: StopFeature[];
}

export interface SelectedStop {
    stop_id: string;
    stop_name?: string;
    platform_code?: string;
    coordinates?: [number, number];
    is_train?: boolean;
    all_ids?: string[];
}
