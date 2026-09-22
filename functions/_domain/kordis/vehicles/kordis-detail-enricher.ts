import type { AppVehicleDetail } from "../../../_core/types";
import { GtfsRtVehicleDetailEnricher } from "../../gtfs/vehicles/GtfsRtVehicleDetailEnricher";
import type { VehiclesService } from "../../gtfs/vehicles/VehiclesService";
import { getVehicleRanges, findVehicleRange } from "../../../_feeds/gtfs/vehicle-ranges";

/** GTFS-RT stop ids like "U01611Z01" as the timetable writes them, "U1611Z1". */
function normalizeKordisStopId(stopId: string): string {
    return stopId.replace(/U0*(\d+)/i, 'U$1').replace(/Z0*(\d+)/i, 'Z$1');
}

/** The operator and model from the fleet register - it covers DPMB and other operators running on IDS JMK ids, e.g. the leased ČD RegioPanter trains. */
async function addFleetMetadata(detail: AppVehicleDetail, vehicles: VehiclesService): Promise<AppVehicleDetail> {
    let operator = 'IDS JMK';

    const num = detail.vehicle_id ? parseInt(detail.vehicle_id, 10) : NaN;
    const ranges = !isNaN(num) ? await getVehicleRanges(vehicles.city) : null;
    const rangeMatch = ranges ? findVehicleRange(num, ranges) : null;

    if (rangeMatch) {
        operator = rangeMatch.operator;
        detail.vehicle_descriptor = {
            ...detail.vehicle_descriptor,
            vehicle_type: rangeMatch.vehicle_type,
            is_air_conditioned: rangeMatch.is_air_conditioned !== undefined ? rangeMatch.is_air_conditioned : detail.vehicle_descriptor?.is_air_conditioned
        };
    }

    detail.vehicle_descriptor = {
        ...detail.vehicle_descriptor,
        operator,
        vehicle_registration_number: detail.vehicle_descriptor?.vehicle_registration_number || ''
    };
    return detail;
}

/** Brno's detail: the standard GTFS-RT enrichment with KORDIS stop ids and IDS JMK fleet metadata. */
export function createKordisVehicleDetailEnricher(vehicles: VehiclesService): GtfsRtVehicleDetailEnricher {
    return new GtfsRtVehicleDetailEnricher(vehicles, {
        normalizeStopId: normalizeKordisStopId,
        afterEnrich: (detail) => addFleetMetadata(detail, vehicles),
    });
}
