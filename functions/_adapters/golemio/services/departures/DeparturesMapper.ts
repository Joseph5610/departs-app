import { AppDeparture, AppDepartureResponse } from "../../../../_core/types";
import { GolemioDepartureItem } from "./types";
import { getVehicleColor } from "../vehicles/colors";
import { getMetroLinesForHeadsign } from "../stops/enrichment";
import { fixCommaSpacing } from "../../../../_core/api-utils";

/**
 * Mapper for flattening and normalizing Golemio's deeply nested departure boards.
 * Groups metro lines by direction (e.g. A-Dejvická vs A-Depo Hostivař) to adhere to UI domain rules.
 */
export class DeparturesMapper {
    /**
     * Maps the raw array-of-arrays response from Golemio into a unified flat list of departures.
     * 
     * @param data Raw nested departure arrays
     * @param stopIds Array of requested stop IDs for reference
     * @returns Normalized departure response
     */
    static map(data: GolemioDepartureItem[][], stopIds: string[]): AppDepartureResponse {
        const departures: AppDeparture[] = [];

        if (Array.isArray(data)) {
            data.forEach((groupData, idx) => {
                if (Array.isArray(groupData)) {
                    const originalStopId = stopIds[idx];
                    groupData.forEach(item => {
                        const normalized = this.normalizeDeparture(item);
                        normalized.stopId = originalStopId;
                        departures.push(normalized);
                    });
                }
            });
        }

        departures.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        return { departures };
    }

    private static normalizeDeparture(item: GolemioDepartureItem): AppDeparture {
        const line = String(item.route?.short_name || '?').toUpperCase();
        const type = String(item.route?.type || (['A', 'B', 'C'].includes(line) ? '1' : '0'));
        const isMetro = type === '1' || ['A', 'B', 'C'].includes(line);
        const isTrain = type === '2' || type === 'rail' || type === 'train';

        let directionId: string | number | null | undefined = item.trip?.direction_id;

        if ((isMetro || isTrain) && item.stop?.id) {
            directionId = item.stop.id;
        }

        if (directionId === undefined || directionId === null) {
            directionId = item.trip?.direction_id ?? item.stop?.platform_code ?? item.trip?.headsign ?? '0';
        }

        const headsign = fixCommaSpacing(item.trip?.headsign) || 'Unknown';

        return {
            timestamp: item.departure.timestamp_predicted || item.departure.timestamp_scheduled,
            scheduled: item.departure.timestamp_scheduled,
            delay: item.departure.delay_seconds || 0,
            line,
            type,
            directionId: String(directionId),
            headsign,
            isCanceled: item.trip?.is_canceled || false,
            tripId: item.trip?.id,
            vehicleId: item.vehicle?.id,
            platform: item.stop?.platform_code || (isMetro && item.stop?.id ? item.stop.id.match(/Z\d+(\d)P?$/)?.[1] : undefined),
            route_color: getVehicleColor(type, line),
            is_wheelchair_accessible: item.vehicle?.is_wheelchair_accessible,
            is_air_conditioned: item.vehicle?.is_air_conditioned,
            headsign_metro_lines: getMetroLinesForHeadsign(headsign).filter(l => l.name !== line)
        };
    }
}
