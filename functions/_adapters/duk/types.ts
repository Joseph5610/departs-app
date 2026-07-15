export interface DukTrafficResponse {
    VehicleList: DukVehicle[];
}

export interface DukVehicle {
    ID: number;
    Delay: number;
    LineID: number;
    RouteID: number;
    HasLowfloor: boolean;
    Longitude: number;
    Latitude: number;
    StationNode: number;
    StationPost: number;
    FinalNode: number;
    ArrivalDT: string;
    TODepartureDT: string;
    LastActivityDT: string;
    CISLineID: number;
    GPSPositionDT: string;
    Azimut: number;
    State: number;
    isAirConditioned: boolean | null;
    qride_tripID: string;
    qride_linename: string;
}

export interface DukDeparturesResponse {
    DeparturesList: DukDeparture[];
}

export interface DukDeparture {
    LineName: string;
    Direction: string;
    StationPost: number;
    DepartureTimeOnlyByTO: boolean;
    TODepartureDT: string;
    DepartureDT: string;
    Delay: string;
    Carrier: string;
    Traction: number;
    Diversions: Array<{ Sequence: number; StopId: number }>;
    informations: unknown[];
}
