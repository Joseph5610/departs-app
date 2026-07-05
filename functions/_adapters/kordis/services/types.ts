export type ApiTrip = {
    trip_id: string;
    start: string;
    end: string;
    dates?: string[];
    start_mins: number;
    end_mins: number;
};

export type ApiMapping = Record<string, ApiTrip[]>;

export interface ArcgisFeature {
    attributes: {
        ID: number;
        TimeUpdated: number;
        IsInactive: string;
        LineID: number;
        RouteID: number;
        Delay?: number;
        VType: number;
        LF?: string;
        LineName?: string;
        Bearing?: number;
        LastStopID?: number;
        FinalStopID?: number;
        Course?: string;
        Lng: number;
        Lat: number;
    };
}

export interface ArcgisResponse {
    features: ArcgisFeature[];
    status?: 'ok' | 'upstream_offline';
}
