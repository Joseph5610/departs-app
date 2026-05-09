export interface Departure {
    timestamp: string;
    scheduled: string;
    delay: number;
    delayDelta?: number;
    lastDelayUpdate?: number;
    line: string;
    type: string;
    directionId: string;
    headsign: string;
    isCanceled: boolean;
    tripId?: string;
    vehicleId?: string;
    platform?: string;
    route_color?: string;
    headsign_metro_lines?: Array<{ name: string; route_color: string }>;
}
