export interface GolemioDepartureItem {
    departure: {
        timestamp_predicted: string | null;
        timestamp_scheduled: string;
        delay_seconds: number | null;
        minutes?: number;
    };
    route: {
        short_name: string;
        type: string | number;
    };
    trip: {
        id: string;
        direction_id?: string | number;
        headsign: string;
        is_canceled: boolean;
    };
    stop: {
        id: string;
        platform_code: string | null;
        sequence?: number;
    };
    vehicle?: {
        id: string;
        is_wheelchair_accessible?: boolean | null;
        is_air_conditioned?: boolean | null;
        has_charger?: boolean | null;
    };
}
