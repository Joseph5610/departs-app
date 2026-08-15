export type ApiTrip = {
    trip_id: string;
    start: string;
    end: string;
    dates?: string[];
    start_mins: number;
    end_mins: number;
};

export type ApiMapping = Record<string, ApiTrip[]>;
