export interface GolemioStopProperties {
    stop_id: string;
    stop_name: string;
    location_type: number;
    parent_station?: string | null;
    platform_code?: string | null;
    zone_id?: string | null;
    wheelchair_boarding?: number;
    level_id?: string | null;
}

export interface GolemioStopFeature {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
    properties: GolemioStopProperties;
}

export interface GolemioStopPayload {
    type: 'FeatureCollection';
    features: GolemioStopFeature[];
}
