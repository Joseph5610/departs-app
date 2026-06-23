export interface Station {
    id: string;
    name: string;
    sequence: number;
    arrival_time: string;
    departure_time: string;
    coordinates: [number, number];
    is_wheelchair_accessible: null;
    zone_id: null;
}
