export interface StopProperties {
    stop_id: string;
    stop_name: string;
    platform_code?: string;
    location_type: number;
    parent_station?: string;
    zone_id?: string;
    is_centroid?: boolean;
    is_drop_off_only?: boolean;
    is_train?: number;
    metro_a?: number;
    metro_b?: number;
    metro_c?: number;
    metro_lines?: Array<{ name: string; route_color: string }>;
    metro_color?: string;
    metro_color_2?: string;
    all_ids?: string[];
    lines?: Array<{ name: string; type: string; route_color: string }>;
    wheelchair_boarding?: number;
    level_id?: string;
}

export interface StopFeature {
    type: "Feature";
    geometry: {
        type: "Point";
        coordinates: [number, number];
    };
    properties: StopProperties;
}

export interface StopCollection {
    type: "FeatureCollection";
    features: StopFeature[];
}

export interface SelectedStop extends Partial<StopProperties> {
    stop_id: string;
    coordinates?: [number, number];
}
