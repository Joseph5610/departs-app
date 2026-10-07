import type { FleetLookup, VehicleMetadata } from '@/types';

/** One entry of a city's fleet register: a contiguous vehicle-number range of one model. */
interface FleetFileRange {
    min: number;
    max: number;
    vehicle_type: string;
    is_air_conditioned?: boolean;
    is_wheelchair_accessible?: boolean;
}

/** The register file: ranges grouped under the operator that runs them. */
export type FleetFile = Record<string, FleetFileRange[]>;

export interface FleetRange extends VehicleMetadata {
    min: number;
    max: number;
}

/** Ranges sorted by `min`, for a binary search by vehicle number. */
export const fleetRanges = (file: FleetFile): FleetRange[] =>
    Object.entries(file)
        .flatMap(([operator, ranges]) => ranges.map(range => ({ ...range, operator })))
        .sort((a, b) => a.min - b.min);

/** The range holding `vehicleNumber`, if any. */
function findRange(ranges: FleetRange[], vehicleNumber: number): FleetRange | undefined {
    let low = 0;
    let high = ranges.length - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        const range = ranges[mid];
        if (vehicleNumber < range.min) high = mid - 1;
        else if (vehicleNumber > range.max) low = mid + 1;
        else return range;
    }
    return undefined;
}

/** Register entry by vehicle id; ids that are not a number are never in the register. */
export const fleetLookup = (ranges: FleetRange[]): FleetLookup => (vehicleId) => {
    if (!vehicleId) return undefined;
    const vehicleNumber = Number(vehicleId);
    return Number.isFinite(vehicleNumber) ? findRange(ranges, vehicleNumber) : undefined;
};
